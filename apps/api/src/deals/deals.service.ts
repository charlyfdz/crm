import {
	ActivityType,
	type Db,
	type DealStage,
	type Prisma,
	Prisma as PrismaNamespace,
} from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import {
	CLOSED_DEAL_STAGES,
	isClosedStage,
	LOSING_DEAL_STAGES,
	OPEN_DEAL_STAGES,
} from "@crm/db/deal-stage";
import type { FieldDefinitionWithOptions } from "@crm/db/fields";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { ARCHIVE } from "../archive/archive-config";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, runBulk } from "../crm/bulk";
import {
	blankToNull,
	decimalFromCents,
	fromCents,
	toCents,
} from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import { PipelinesService } from "../pipelines/pipelines.service";
import {
	archivedFilter,
	countsByKey,
	FACET_UNASSIGNED,
	type ListResult,
	type OrderByColumns,
	ownerFilter,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	ClosingWindow,
	DealAttachContactInput,
	DealBulkOwnerInput,
	DealBulkStageInput,
	DealContactRoleInput,
	DealCreateInput,
	DealDetachContactInput,
	DealListInput,
	DealUpdateInput,
	SetStageInput,
} from "./deals.contracts";
import { CLOSING_WINDOWS } from "./deals.contracts";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const COMPANY_SELECT = {
	id: true,
	name: true,
	domain: true,
	iconUrl: true,
	iconDarkUrl: true,
	iconTone: true,
	logoUrl: true,
} as const;

const CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	title: true,
	imageUrl: true,
} as const;

const LOSING = new Set<DealStage>(LOSING_DEAL_STAGES);

const SORTABLE: OrderByColumns<Prisma.DealOrderByWithRelationInput[]> = {
	name: (dir) => [{ name: dir }],
	company: (dir) => [{ company: { name: dir } }, { name: "asc" }],
	stage: (dir) => [
		{ pipelineStage: { pipeline: { name: dir } } },
		{ pipelineStage: { position: dir } },
		{ expectedCloseDate: "asc" },
		{ id: "asc" },
	],
	amount: (dir) => [{ baseAmount: { sort: dir, nulls: "last" } }],
	expectedCloseDate: (dir) => [{ expectedCloseDate: dir }],
	createdAt: (dir) => [{ createdAt: dir }],
	owner: (dir) => [{ owner: { name: dir } }, { name: "asc" }],
	lastActivity: (dir) => [{ lastActivityAt: { sort: dir, nulls: "last" } }],
	archivedAt: (dir) => [{ archivedAt: { sort: dir, nulls: "last" } }],
};

@Injectable()
export class DealsService {
	private readonly logger = new Logger(DealsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly stamp: ActivityStampService,
		private readonly conversion: ConversionService,
		private readonly fields: FieldsService,
		private readonly pipelines: PipelinesService = new PipelinesService(db),
	) {}

	async list(input: DealListInput, actingUserId?: string) {
		await this.membership(actingUserId);
		const filterableFields = await this.fields.filterableFieldsFor("DEAL");
		const where = this.buildWhere(input, filterableFields);
		const { skip, take } = paginate(input);

		const openWhere = { ...where, stage: { in: [...OPEN_DEAL_STAGES] } };
		const base = await this.conversion.reportingCurrency();

		const [rows, total, facetCounts, openValue, unconverted] =
			await Promise.all([
				this.db.deal.findMany({
					where,
					skip,
					take,
					orderBy: resolveOrderBy(input, SORTABLE, [{ createdAt: "desc" }]),
					select: {
						id: true,
						name: true,
						stage: true,
						pipelineStage: {
							select: {
								id: true,
								name: true,
								position: true,
								outcome: true,
								legacyStage: true,
								pipelineId: true,
								pipeline: { select: { id: true, name: true } },
							},
						},
						amount: true,
						currency: true,
						baseAmount: true,
						expectedCloseDate: true,
						closedAt: true,
						company: { select: COMPANY_SELECT },
						owner: { select: OWNER_SELECT },
						lastActivityAt: true,
						createdAt: true,
						archivedAt: true,
					},
				}),
				this.db.deal.count({ where }),
				this.facetCounts(input, filterableFields),
				this.db.deal.aggregate({
					where: { AND: [openWhere, this.conversion.countedWhere(base)] },
					_sum: { baseAmount: true },
				}),
				this.conversion.unconverted(openWhere),
			]);

		const tableFields = await this.fields.tableValuesFor(
			"DEAL",
			rows.map((row) => row.id),
		);

		return {
			rows: rows.map(
				({
					amount,
					baseAmount,
					expectedCloseDate,
					closedAt,
					lastActivityAt,
					createdAt,
					archivedAt,
					...row
				}) => ({
					...row,
					amountCents: toCents(amount),
					baseAmountCents: toCents(baseAmount),
					expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
					closedAt: closedAt?.toISOString() ?? null,
					lastActivityAt: lastActivityAt?.toISOString() ?? null,
					createdAt: createdAt.toISOString(),
					archivedAt: archivedAt?.toISOString() ?? null,
					fields: tableFields.get(row.id) ?? {},
				}),
			),
			total,
			facetCounts,
			openValueCents: toCents(openValue._sum.baseAmount),
			reportingCurrency: base,
			unconverted,
		} satisfies ListResult<unknown> & {
			openValueCents: number | null;
			reportingCurrency: string;
			unconverted: { count: number; currencies: string[] };
		};
	}

	async byId(id: string, actingUserId?: string) {
		await this.membership(actingUserId);
		const deal = await this.db.deal.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				description: true,
				stage: true,
				pipelineStage: {
					select: {
						id: true,
						name: true,
						position: true,
						outcome: true,
						legacyStage: true,
						pipelineId: true,
						pipeline: { select: { id: true, name: true } },
					},
				},
				stageChangedAt: true,
				amount: true,
				currency: true,
				baseAmount: true,
				fxRate: true,
				fxRateAt: true,
				expectedCloseDate: true,
				closedAt: true,
				closedReason: true,
				createdAt: true,
				archivedAt: true,
				company: { select: { ...COMPANY_SELECT, industry: true } },
				owner: { select: OWNER_SELECT },
				contacts: {
					select: { role: true, contact: { select: CONTACT_SELECT } },
					orderBy: { contact: { firstName: "asc" } },
				},
			},
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${id}.`);
		}

		const {
			contacts,
			amount,
			baseAmount,
			fxRate,
			fxRateAt,
			archivedAt,
			...rest
		} = deal;

		return {
			...rest,
			fields: await this.fields.valuesFor("DEAL", id),
			amountCents: toCents(amount),
			baseAmountCents: toCents(baseAmount),
			reportingCurrency: await this.conversion.reportingCurrency(),
			fxRate: fxRate?.toNumber() ?? null,
			fxRateAt: fxRateAt?.toISOString() ?? null,
			stageChangedAt: deal.stageChangedAt.toISOString(),
			expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
			closedAt: deal.closedAt?.toISOString() ?? null,
			createdAt: deal.createdAt.toISOString(),
			archivedAt: archivedAt?.toISOString() ?? null,
			contacts: contacts.map(({ role, contact }) => ({ ...contact, role })),
		};
	}

	async create(input: DealCreateInput, actingUserId?: string) {
		if (!actingUserId)
			throw new ForbiddenException("La identidad del usuario es obligatoria.");
		const role = await this.pipelines.membership(actingUserId);
		if (input.ownerId !== actingUserId && !["owner", "admin"].includes(role))
			throw new ForbiddenException(
				"Sólo administración asigna oportunidades a otra persona.",
			);
		const now = new Date();

		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const fx = await this.conversion.dealFields(
			decimalFromCents(input.amountCents),
			currency,
		);

		try {
			const deal = await this.agent.withCrmEvents(async (tx, emit) => {
				const currentRole = await this.pipelines.membership(actingUserId, tx);
				if (
					input.ownerId !== actingUserId &&
					!["owner", "admin"].includes(currentRole)
				)
					throw new ForbiddenException(
						"Sólo administración asigna oportunidades a otra persona.",
					);
				await this.pipelines.membership(input.ownerId, tx);
				const company = await tx.company.findFirst({
					where: { id: input.companyId, archivedAt: null },
					select: { id: true },
				});
				if (!company)
					throw new BadRequestException(
						"La empresa no existe o está archivada.",
					);
				const target = await this.pipelines.resolveStage(tx, input);
				const stage = target.legacyStage;
				const closed = target.outcome !== "OPEN";
				const closedReason = input.closedReason?.trim() || null;
				if (["LOST", "DISQUALIFIED"].includes(target.outcome) && !closedReason)
					throw new BadRequestException("Indica el motivo del cierre.");
				const created = await tx.deal.create({
					data: {
						name: input.name.trim(),
						companyId: input.companyId,
						ownerId: input.ownerId,
						stage,
						pipelineStageId: target.id,
						stageChangedAt: now,
						closedAt: closed ? now : null,
						closedReason: closed ? closedReason : null,
						amount: fromCents(input.amountCents),
						currency,
						...fx,
						expectedCloseDate: parseDate(input.expectedCloseDate),
					},
					select: { id: true, name: true, companyId: true },
				});
				await this.recordStageChange(
					tx,
					{
						id: created.id,
						companyId: created.companyId,
						ownerId: input.ownerId,
						name: created.name,
					},
					null,
					target,
					actingUserId,
					closedReason,
					now,
				);
				await emit({
					type: "deal.created",
					record: { kind: "deal", id: created.id },
					occurredAt: now,
					data: { companyId: created.companyId, stage },
				});
				if (closed) {
					await emit({
						type: "deal.closed",
						record: { kind: "deal", id: created.id },
						occurredAt: now,
						data: { companyId: created.companyId, from: null, to: stage },
					});
				}
				return created;
			});

			this.logger.log({ message: "Deal created", dealId: deal.id });

			void this.fields.queueBackfillForNewRecord("DEAL", deal.id);

			return deal;
		} catch (error) {
			throw this.translateRelations(error);
		}
	}

	async update(id: string, input: DealUpdateInput, actingUserId?: string) {
		const data: Prisma.DealUpdateInput = {};
		let moneySnapshot:
			| { amount: Prisma.Decimal | null; currency: string }
			| undefined;

		if (input.name !== undefined) data.name = input.name.trim();
		if (input.description !== undefined) {
			data.description =
				input.description === null ? null : blankToNull(input.description);
		}
		if (input.companyId !== undefined) {
			data.company = { connect: { id: input.companyId } };
		}
		if (input.ownerId !== undefined) {
			data.owner = { connect: { id: input.ownerId } };
		}
		if (input.amountCents !== undefined) {
			data.amount = fromCents(input.amountCents);
		}
		if (input.currency !== undefined) {
			data.currency = normalizeCurrency(input.currency);
		}
		if (input.expectedCloseDate !== undefined) {
			data.expectedCloseDate = parseDate(input.expectedCloseDate);
		}

		if (input.amountCents !== undefined || input.currency !== undefined) {
			const role = await this.membership(actingUserId);
			const current = await this.db.deal.findUnique({
				where: { id },
				select: {
					amount: true,
					currency: true,
					ownerId: true,
					archivedAt: true,
				},
			});

			if (!current) {
				throw new NotFoundException(`No deal with id ${id}.`);
			}
			this.assertEditable(current, role, actingUserId);
			moneySnapshot = current;

			const amount =
				input.amountCents !== undefined
					? decimalFromCents(input.amountCents)
					: current.amount;
			const currency =
				input.currency !== undefined
					? normalizeCurrency(input.currency)
					: normalizeCurrency(current.currency);

			Object.assign(data, await this.conversion.dealFields(amount, currency));
		}

		try {
			return await this.db.$transaction(async (tx) => {
				const { deal, role } = await this.authorizedDeal(
					tx,
					id,
					actingUserId,
					"edit",
				);
				if (input.ownerId !== undefined) {
					if (
						input.ownerId !== deal.ownerId &&
						!["owner", "admin"].includes(role)
					)
						throw new ForbiddenException(
							"Sólo administración puede reasignar oportunidades.",
						);
					await this.membership(input.ownerId, tx);
				}
				if (input.companyId !== undefined) {
					const [company] = await tx.$queryRaw<
						Array<{ archivedAt: Date | null }>
					>`
						SELECT "archivedAt" FROM company WHERE id = ${input.companyId} FOR SHARE
					`;
					if (!company || company.archivedAt)
						throw new BadRequestException("Selecciona una empresa activa.");
					const linked = await tx.$queryRaw<
						Array<{ companyId: string | null }>
					>`
						SELECT c."companyId" FROM contact c
						JOIN "dealContact" dc ON dc."contactId" = c.id
						WHERE dc."dealId" = ${id} FOR SHARE OF c
					`;
					if (linked.some((contact) => contact.companyId !== input.companyId))
						throw new BadRequestException(
							"Desvincula los contactos incompatibles antes de cambiar la empresa.",
						);
				}
				if (moneySnapshot) {
					const current = await tx.deal.findUniqueOrThrow({
						where: { id },
						select: { amount: true, currency: true },
					});
					if (
						current.amount?.toString() !== moneySnapshot.amount?.toString() ||
						current.currency !== moneySnapshot.currency
					)
						throw new ConflictException(
							"El importe cambió durante la edición. Recarga y vuelve a intentarlo.",
						);
				}
				if (input.fields) {
					await this.fields.applyValues(tx, "DEAL", id, input.fields);
				}

				return tx.deal.update({
					where: { id },
					data,
					select: { id: true, name: true },
				});
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async archive(
		id: string,
		actingUserId?: string,
	): Promise<{ id: string; name: string }> {
		try {
			const deal = await this.db.$transaction(async (tx) => {
				const { deal } = await this.authorizedDeal(
					tx,
					id,
					actingUserId,
					"archive",
				);
				return tx.deal.update({
					where: { id },
					data: { archivedAt: deal.archivedAt ?? new Date() },
					select: { name: true },
				});
			});

			this.logger.log({ message: "Deal archived", dealId: id });

			return { id, name: deal.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async restore(
		id: string,
		actingUserId?: string,
	): Promise<{ id: string; name: string }> {
		try {
			const deal = await this.db.$transaction(async (tx) => {
				await this.authorizedDeal(tx, id, actingUserId, "restore");
				return tx.deal.update({
					where: { id },
					data: { archivedAt: null },
					select: { name: true },
				});
			});

			this.logger.log({ message: "Deal restored", dealId: id });

			return { id, name: deal.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async purge(
		id: string,
		actingUserId?: string,
	): Promise<{ id: string; name: string }> {
		const deleted = await this.purgeRecord(id, undefined, actingUserId);
		if (!deleted) throw new NotFoundException(`No deal with id ${id}.`);
		return deleted;
	}

	private async purgeRecord(
		id: string,
		guard?: { archivedBefore: Date },
		actingUserId?: string,
	): Promise<{ id: string; name: string } | null> {
		let deleted: { targets: StampTargets; name: string } | null;

		try {
			deleted = await this.db.$transaction(async (tx) => {
				if (!guard) await this.authorizedDeal(tx, id, actingUserId, "purge");
				const [row] = await tx.$queryRaw<Array<{ archivedAt: Date | null }>>`
					SELECT "archivedAt" FROM deal WHERE id = ${id} FOR UPDATE
				`;

				if (!row) {
					if (guard) return null;
					throw new NotFoundException(`No deal with id ${id}.`);
				}
				if (
					guard &&
					(!row.archivedAt || row.archivedAt > guard.archivedBefore)
				) {
					return null;
				}

				const targets = await this.stamp.targetsOf({ dealId: id }, tx);
				await tx.agentTask.deleteMany({ where: { dealId: id } });

				const deal = await tx.deal.delete({
					where: { id },
					select: { name: true },
				});

				return { targets, name: deal.name };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		if (!deleted) return null;

		await this.stamp.recomputeAfterDelete(deleted.targets, { dealId: id });

		this.logger.log({
			message: "Deal purged",
			dealId: id,
			name: deleted.name,
		});

		return { id, name: deleted.name };
	}

	async purgeExpired(before: Date): Promise<BulkResult> {
		const expired = await this.db.deal.findMany({
			where: { archivedAt: { lte: before } },
			select: { id: true },
			take: ARCHIVE.prune.maxBatch,
		});

		return runBulk(
			expired.map((row) => row.id),
			(id) => this.purgeRecord(id, { archivedBefore: before }),
		);
	}

	async setStage(input: SetStageInput, actingUserId: string) {
		const closedReason = input.closedReason?.trim();
		if (!input.stage && !input.pipelineStageId)
			throw new BadRequestException("Selecciona la nueva etapa.");
		const transition = await this.agent.withCrmEvents(async (tx, emit) => {
			const role = await this.pipelines.membership(actingUserId, tx);
			const locked = await tx.$queryRaw<Array<{ id: string }>>`
				SELECT id
				FROM deal
				WHERE id = ${input.id}
				FOR UPDATE
			`;
			const deal = locked.length
				? await tx.deal.findUnique({
						where: { id: input.id },
						include: { pipelineStage: { include: { pipeline: true } } },
					})
				: null;

			if (!deal) {
				throw new NotFoundException(`No deal with id ${input.id}.`);
			}
			if (deal.archivedAt)
				throw new BadRequestException(
					"Restaura la oportunidad antes de cambiarla.",
				);
			if (deal.ownerId !== actingUserId && !["owner", "admin"].includes(role))
				throw new ForbiddenException(
					"No tienes permiso para cambiar esta oportunidad.",
				);
			const target = await this.pipelines.resolveStage(
				tx,
				input,
				input.pipelineId ? undefined : deal.pipelineStage?.pipelineId,
			);
			const closed = target.outcome !== "OPEN";

			if (deal.pipelineStageId === target.id) {
				return {
					changed: false as const,
					deal,
					updated: { id: deal.id, stage: deal.stage },
					now: null,
				};
			}
			if (["LOST", "DISQUALIFIED"].includes(target.outcome) && !closedReason) {
				throw new BadRequestException(
					"Say why it was lost — a closed-lost deal with no reason teaches nobody anything.",
				);
			}

			const now = new Date();
			const updated = await tx.deal.update({
				where: { id: input.id },
				data: {
					stage: target.legacyStage,
					pipelineStageId: target.id,
					stageChangedAt: now,
					closedAt: closed ? now : null,
					closedReason: closed ? (closedReason ?? null) : null,
				},
				select: { id: true, stage: true },
			});
			await this.recordStageChange(
				tx,
				deal,
				deal.pipelineStage,
				target,
				actingUserId,
				closedReason ?? null,
				now,
			);
			await tx.activity.create({
				data: {
					type: ActivityType.STAGE_CHANGE,
					subject: "Stage changed",
					body: closedReason ?? null,
					occurredAt: now,
					companyId: deal.companyId,
					dealId: deal.id,
					createdById: actingUserId,
					meta: {
						from: deal.stage,
						to: target.legacyStage,
						fromStageId: deal.pipelineStageId,
						toStageId: target.id,
						fromStageName: deal.pipelineStage?.name ?? null,
						toStageName: target.name,
					},
				},
			});
			await emit({
				type: "deal.stage.changed",
				record: { kind: "deal", id: deal.id },
				occurredAt: now,
				data: {
					companyId: deal.companyId,
					from: deal.stage,
					to: target.legacyStage,
				},
			});
			if (!isClosedStage(deal.stage) && closed) {
				await emit({
					type: "deal.closed",
					record: { kind: "deal", id: deal.id },
					occurredAt: now,
					data: {
						companyId: deal.companyId,
						from: deal.stage,
						to: target.legacyStage,
					},
				});
			}
			if (isClosedStage(deal.stage) && !closed) {
				await emit({
					type: "deal.opened",
					record: { kind: "deal", id: deal.id },
					occurredAt: now,
					data: {
						companyId: deal.companyId,
						from: deal.stage,
						to: target.legacyStage,
					},
				});
			}

			return { changed: true as const, deal, updated, now };
		});

		if (!transition.changed) {
			return { ...transition.updated, changed: false };
		}

		const { deal, updated, now } = transition;

		try {
			await this.stamp.touch(
				{ companyId: deal.companyId, dealId: deal.id },
				now,
			);
		} catch (error) {
			this.logger.error(
				{
					message: "Deal stage saved but activity stamps need repair",
					dealId: deal.id,
				},
				error instanceof Error ? error.stack : String(error),
			);
		}

		this.logger.log({
			message: "Deal stage changed",
			dealId: deal.id,
			from: deal.stage,
			to: updated.stage,
		});

		return { ...updated, changed: true };
	}

	async stageHistory(id: string, actingUserId: string) {
		await this.pipelines.membership(actingUserId);
		const deal = await this.db.deal.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!deal) throw new NotFoundException("No existe la oportunidad.");
		const changes = await this.db.dealStageChange.findMany({
			where: { dealId: id },
			orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
		});
		return changes.map(({ occurredAt, ...change }) => ({
			...change,
			occurredAt: occurredAt.toISOString(),
		}));
	}

	private async recordStageChange(
		tx: Prisma.TransactionClient,
		deal: { id: string; companyId: string; ownerId: string; name: string },
		from: {
			id: string;
			name: string;
			outcome: string;
			pipeline: { id: string; name: string };
		} | null,
		to: {
			id: string;
			name: string;
			outcome: string;
			pipeline: { id: string; name: string };
		},
		actorId: string,
		reason: string | null,
		occurredAt: Date,
	) {
		const change = await tx.dealStageChange.create({
			data: {
				dealId: deal.id,
				actorId,
				occurredAt,
				reason,
				fromStageId: from?.id ?? null,
				fromStageName: from?.name ?? null,
				fromOutcome:
					from?.outcome as Prisma.DealStageChangeCreateInput["fromOutcome"],
				fromPipelineId: from?.pipeline.id ?? null,
				fromPipelineName: from?.pipeline.name ?? null,
				toStageId: to.id,
				toStageName: to.name,
				toOutcome: to.outcome as Prisma.DealStageChangeCreateInput["toOutcome"],
				toPipelineId: to.pipeline.id,
				toPipelineName: to.pipeline.name,
			},
			select: { id: true },
		});
		if (to.outcome === "WON" && from?.outcome !== "WON") {
			await this.pipelines.membership(deal.ownerId, tx);
			await tx.activity.create({
				data: {
					id: `handoff-${change.id}`,
					type: ActivityType.TASK,
					subject: `Transferencia operativa: ${deal.name}`,
					body: "Revisa el alcance acordado y coordina la entrega del servicio.",
					dueAt: occurredAt,
					companyId: deal.companyId,
					dealId: deal.id,
					createdById: actorId,
					assigneeId: deal.ownerId,
					priority: 2,
					meta: {
						source: "manual",
						stageChangeId: change.id,
						purpose: "won-handoff",
					},
				},
			});
		}
	}

	async contactOptions(dealId: string, actingUserId?: string) {
		await this.membership(actingUserId);
		const deal = await this.db.deal.findUnique({
			where: { id: dealId },
			select: { companyId: true, contacts: { select: { contactId: true } } },
		});

		if (!deal) {
			throw new NotFoundException(`No deal with id ${dealId}.`);
		}

		return this.db.contact.findMany({
			where: {
				archivedAt: null,
				companyId: deal.companyId,
				id: { notIn: deal.contacts.map((row) => row.contactId) },
			},
			select: CONTACT_SELECT,
			orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
			take: 100,
		});
	}

	async attachContact(input: DealAttachContactInput, actingUserId?: string) {
		const role = roleOrNull(input.role ?? null);
		await this.db.$transaction(async (tx) => {
			const { deal } = await this.authorizedDeal(
				tx,
				input.dealId,
				actingUserId,
				"edit",
			);
			await this.activeContact(tx, input.contactId, deal.companyId);
			await tx.dealContact.upsert({
				where: {
					dealId_contactId: {
						dealId: input.dealId,
						contactId: input.contactId,
					},
				},
				create: { dealId: input.dealId, contactId: input.contactId, role },
				update: role === null ? {} : { role },
			});
		});

		this.logger.log({
			message: "Contact attached to deal",
			dealId: input.dealId,
			contactId: input.contactId,
		});

		return { dealId: input.dealId, contactId: input.contactId };
	}

	async detachContact(input: DealDetachContactInput, actingUserId?: string) {
		await this.db.$transaction(async (tx) => {
			await this.authorizedDeal(tx, input.dealId, actingUserId, "edit");
			const { count } = await tx.dealContact.deleteMany({
				where: { dealId: input.dealId, contactId: input.contactId },
			});
			if (count === 0)
				throw new NotFoundException("That contact is not on this deal.");
		});

		this.logger.log({
			message: "Contact detached from deal",
			dealId: input.dealId,
			contactId: input.contactId,
		});

		return { dealId: input.dealId, contactId: input.contactId };
	}

	async setContactRole(input: DealContactRoleInput, actingUserId?: string) {
		const role = roleOrNull(input.role);
		await this.db.$transaction(async (tx) => {
			const { deal } = await this.authorizedDeal(
				tx,
				input.dealId,
				actingUserId,
				"edit",
			);
			await this.activeContact(tx, input.contactId, deal.companyId);
			const { count } = await tx.dealContact.updateMany({
				where: { dealId: input.dealId, contactId: input.contactId },
				data: { role },
			});
			if (count === 0)
				throw new NotFoundException("That contact is not on this deal.");
		});

		return { dealId: input.dealId, contactId: input.contactId, role };
	}

	async bulkAssignOwner(
		input: DealBulkOwnerInput,
		actingUserId?: string,
	): Promise<BulkResult> {
		await this.membership(actingUserId, this.db, true);
		await this.membership(input.ownerId);
		return runBulk(input.ids, (id) =>
			this.update(id, { ownerId: input.ownerId }, actingUserId),
		);
	}

	async bulkSetStage(
		input: DealBulkStageInput,
		actingUserId: string,
	): Promise<BulkResult> {
		await this.membership(actingUserId);
		const closedReason = input.closedReason?.trim();

		if (input.stage && LOSING.has(input.stage) && !closedReason) {
			throw new BadRequestException(
				"Say why they were lost — a closed-lost deal with no reason teaches nobody anything.",
			);
		}

		if (!input.stage && !input.pipelineStageId)
			throw new BadRequestException("Selecciona una etapa.");
		return runBulk(input.ids, (id) =>
			this.setStage(
				{
					id,
					stage: input.stage,
					pipelineId: input.pipelineId,
					pipelineStageId: input.pipelineStageId,
					closedReason,
				},
				actingUserId,
			),
		);
	}

	async bulkArchive(ids: string[], actingUserId?: string): Promise<BulkResult> {
		await this.membership(actingUserId);
		return runBulk(ids, (id) => this.archive(id, actingUserId));
	}

	async bulkRestore(ids: string[], actingUserId?: string): Promise<BulkResult> {
		await this.membership(actingUserId);
		return runBulk(ids, (id) => this.restore(id, actingUserId));
	}

	async bulkPurge(ids: string[], actingUserId?: string): Promise<BulkResult> {
		if ((await this.membership(actingUserId)) !== "owner")
			throw new ForbiddenException(
				"Sólo el propietario puede eliminar oportunidades definitivamente.",
			);
		return runBulk(ids, (id) => this.purge(id, actingUserId));
	}

	private async membership(
		actingUserId?: string,
		tx: Db | Prisma.TransactionClient = this.db,
		administrative = false,
	) {
		if (!actingUserId)
			throw new ForbiddenException(
				"Falta la identidad autenticada de la operación.",
			);
		return this.pipelines.membership(actingUserId, tx, administrative);
	}

	private assertEditable(
		deal: { ownerId: string; archivedAt: Date | null },
		role: string,
		actingUserId?: string,
	) {
		if (deal.ownerId !== actingUserId && !["owner", "admin"].includes(role))
			throw new ForbiddenException(
				"No tienes permiso para cambiar esta oportunidad.",
			);
		if (deal.archivedAt)
			throw new BadRequestException(
				"Restaura la oportunidad antes de cambiarla.",
			);
	}

	private async authorizedDeal(
		tx: Prisma.TransactionClient,
		id: string,
		actingUserId: string | undefined,
		action: "edit" | "archive" | "restore" | "purge",
	) {
		const role = await this.membership(actingUserId, tx);
		const [deal] = await tx.$queryRaw<
			Array<{
				id: string;
				ownerId: string;
				companyId: string;
				archivedAt: Date | null;
			}>
		>`
			SELECT id, "ownerId", "companyId", "archivedAt" FROM deal WHERE id = ${id} FOR UPDATE
		`;
		if (!deal) throw new NotFoundException(`No deal with id ${id}.`);
		if (action === "purge") {
			if (role !== "owner")
				throw new ForbiddenException(
					"Sólo el propietario puede eliminar oportunidades definitivamente.",
				);
			if (!deal.archivedAt)
				throw new BadRequestException(
					"Archiva la oportunidad antes de eliminarla definitivamente.",
				);
		} else if (action === "edit") {
			this.assertEditable(deal, role, actingUserId);
		} else if (
			deal.ownerId !== actingUserId &&
			!["owner", "admin"].includes(role)
		) {
			throw new ForbiddenException(
				"No tienes permiso para cambiar esta oportunidad.",
			);
		}
		return { deal, role };
	}

	private async activeContact(
		tx: Prisma.TransactionClient,
		id: string,
		companyId: string,
	) {
		const [contact] = await tx.$queryRaw<
			Array<{ companyId: string | null; archivedAt: Date | null }>
		>`
			SELECT "companyId", "archivedAt" FROM contact WHERE id = ${id} FOR SHARE
		`;
		if (!contact) throw new NotFoundException(`No contact with id ${id}.`);
		if (contact.archivedAt || contact.companyId !== companyId)
			throw new BadRequestException(
				"Selecciona un contacto activo de la misma empresa.",
			);
	}

	private searchFilter(q: string): Prisma.DealWhereInput {
		const term = q.trim();
		if (!term) return {};

		return {
			OR: [
				{ name: { contains: term, mode: "insensitive" } },
				{ company: { name: { contains: term, mode: "insensitive" } } },
			],
		};
	}

	private buildWhere(
		input: DealListInput,
		filterableFields: FieldDefinitionWithOptions[],
	): Prisma.DealWhereInput {
		const and: Prisma.DealWhereInput[] = [
			this.searchFilter(input.q),
			archivedFilter(input.archived),
			...this.fields.fieldFilters(filterableFields, input.fields),
		];

		const owner = ownerFilter<Prisma.DealWhereInput>(input.owner);
		if (owner) and.push(owner);
		if (input.pipelineId)
			and.push({ pipelineStage: { pipelineId: input.pipelineId } });
		if (input.pipelineStageIds?.length)
			and.push({ pipelineStageId: { in: input.pipelineStageIds } });

		if (input.status === "open") {
			and.push({ stage: { in: [...OPEN_DEAL_STAGES] } });
		} else if (input.status === "closed") {
			and.push({ stage: { in: [...CLOSED_DEAL_STAGES] } });
		}

		if (input.stage.length > 0) {
			and.push({ stage: { in: input.stage as DealStage[] } });
		}

		if (input.closing.length > 0) {
			and.push({
				OR: input.closing.map((window) =>
					closingFilter(window as ClosingWindow),
				),
			});
		}

		return { AND: and };
	}

	private async facetCounts(
		input: DealListInput,
		filterableFields: FieldDefinitionWithOptions[],
	) {
		const where: Prisma.DealWhereInput = {
			AND: [
				this.searchFilter(input.q),
				archivedFilter(input.archived),
				...(input.pipelineId
					? [{ pipelineStage: { pipelineId: input.pipelineId } }]
					: []),
				...(input.pipelineStageIds?.length
					? [{ pipelineStageId: { in: input.pipelineStageIds } }]
					: []),
			],
		};

		const [owners, stages, pipelineStages, fieldFacets, ...closingCounts] =
			await Promise.all([
				this.db.deal.groupBy({
					by: ["ownerId"],
					where,
					_count: { _all: true },
				}),
				this.db.deal.groupBy({ by: ["stage"], where, _count: { _all: true } }),
				this.db.deal.groupBy({
					by: ["pipelineStageId"],
					where,
					_count: { _all: true },
				}),
				this.fields.filterFacetCounts("DEAL", where, filterableFields),
				...CLOSING_WINDOWS.map((window) =>
					this.db.deal.count({
						where: { AND: [where, closingFilter(window)] },
					}),
				),
			]);

		const stageCounts = countsByKey(stages, "stage");
		const openCount = OPEN_DEAL_STAGES.reduce(
			(total, stage) => total + (stageCounts[stage] ?? 0),
			0,
		);
		const closedCount = CLOSED_DEAL_STAGES.reduce(
			(total, stage) => total + (stageCounts[stage] ?? 0),
			0,
		);

		return {
			status: { open: openCount, closed: closedCount },
			owner: countsByKey(owners, "ownerId", FACET_UNASSIGNED),
			stage: stageCounts,
			pipelineStageIds: countsByKey(pipelineStages, "pipelineStageId"),
			closing: Object.fromEntries(
				CLOSING_WINDOWS.map((window, index) => [
					window,
					closingCounts[index] ?? 0,
				]),
			),
			...Object.fromEntries(
				Object.entries(fieldFacets).map(([key, counts]) => [
					`field:${key}`,
					counts,
				]),
			),
		};
	}

	private translate(cause: unknown, id: string): never {
		if (
			cause instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			cause.code === "P2025"
		) {
			throw new NotFoundException(`No deal with id ${id}.`);
		}
		return this.translateRelations(cause);
	}

	private translateRelations(cause: unknown): never {
		if (
			cause instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			(cause.code === "P2003" || cause.code === "P2025")
		) {
			throw new BadRequestException(
				"That company or owner does not exist any more.",
			);
		}
		throw cause;
	}
}

function closingFilter(window: ClosingWindow): Prisma.DealWhereInput {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const startOfMonthAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);

	switch (window) {
		case "overdue":
			return {
				expectedCloseDate: { lt: now },
				stage: { in: [...OPEN_DEAL_STAGES] },
			};
		case "this-month":
			return {
				expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
			};
		case "next-month":
			return {
				expectedCloseDate: { gte: startOfNextMonth, lt: startOfMonthAfter },
			};
		case "later":
			return { expectedCloseDate: { gte: startOfMonthAfter } };
		case "none":
			return { expectedCloseDate: null };
	}
}

function roleOrNull(value: string | null): string | null {
	return value === null ? null : blankToNull(value);
}

function parseDate(value: string | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`"${value}" is not a date.`);
	}
	return date;
}
