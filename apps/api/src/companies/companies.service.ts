import {
	type Db,
	type EnrichmentStatus,
	type Prisma,
	Prisma as PrismaNamespace,
	type RecordSource,
} from "@crm/db";
import { OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import type { FieldDefinitionWithOptions } from "@crm/db/fields";
import { aiFeaturePolicy, isAiEnabled } from "@crm/env/features";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentQueueService } from "../agent/agent-queue.service";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { requireApiAiEnabled } from "../agent/ai-policy";
import { ARCHIVE } from "../archive/archive-config";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, runBulk } from "../crm/bulk";
import {
	authorizedRecord,
	recordMembership,
	recordOwner,
} from "../crm/record-access";
import { blankToNull, toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import {
	activityFacetCounts,
	activityFilter,
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
	CompanyBulkOwnerInput,
	CompanyCreateInput,
	CompanyListInput,
	CompanyRow,
	CompanyUpdateInput,
} from "./companies.contracts";
import { normalizeDomain } from "./domain";
import { FaviconService } from "./favicon.service";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const SORTABLE: OrderByColumns<Prisma.CompanyOrderByWithRelationInput> = {
	name: (dir) => ({ name: dir }),
	domain: (dir) => ({ domain: dir }),
	industry: (dir) => ({ industry: dir }),
	createdAt: (dir) => ({ createdAt: dir }),
	contacts: (dir) => ({ contacts: { _count: dir } }),
	deals: (dir) => ({ deals: { _count: dir } }),
	owner: (dir) => ({ owner: { name: dir } }),
	lastActivity: (dir) => ({ lastActivityAt: { sort: dir, nulls: "last" } }),
	archivedAt: (dir) => ({ archivedAt: { sort: dir, nulls: "last" } }),
};

@Injectable()
export class CompaniesService {
	private readonly logger = new Logger(CompaniesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly queue: AgentQueueService,
		private readonly favicon: FaviconService,
		private readonly stamp: ActivityStampService,
		private readonly conversion: ConversionService,
		private readonly fields: FieldsService,
	) {}

	async list(
		input: CompanyListInput,
		userId: string,
	): Promise<ListResult<CompanyRow>> {
		await recordMembership(this.db, userId);
		const filterableFields = await this.fields.filterableFieldsFor("COMPANY");
		const where = this.buildWhere(input, filterableFields);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			this.db.company.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, {
					createdAt: "desc",
				}),
				select: {
					id: true,
					name: true,
					domain: true,
					iconUrl: true,
					iconDarkUrl: true,
					iconTone: true,
					logoUrl: true,
					brandColor: true,
					industry: true,
					enrichmentStatus: true,
					source: true,
					owner: { select: OWNER_SELECT },
					_count: {
						select: {
							contacts: true,
							deals: { where: { stage: { in: [...OPEN_DEAL_STAGES] } } },
						},
					},
					lastActivityAt: true,
					createdAt: true,
					archivedAt: true,
				},
			}),
			this.db.company.count({ where }),
			this.facetCounts(input, filterableFields),
		]);

		const ids = rows.map((row) => row.id);
		const [queued, tableFields] = await Promise.all([
			isAiEnabled() ? this.queue.queuedCompanies(ids) : new Set<string>(),
			this.fields.tableValuesFor("COMPANY", ids),
		]);

		return {
			rows: rows.map((row) => ({
				id: row.id,
				name: row.name,
				domain: row.domain,
				iconUrl: row.iconUrl,
				iconDarkUrl: row.iconDarkUrl,
				iconTone: row.iconTone,
				logoUrl: row.logoUrl,
				brandColor: row.brandColor,
				industry: row.industry,
				enrichmentStatus: row.enrichmentStatus,
				queued: isAiEnabled() && queued.has(row.id),
				ai: aiFeaturePolicy(),
				source: row.source,
				owner: row.owner,
				contactCount: row._count.contacts,
				openDealCount: row._count.deals,
				lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
				archivedAt: row.archivedAt?.toISOString() ?? null,
				fields: tableFields.get(row.id) ?? {},
			})),
			total,
			facetCounts,
		};
	}

	async byId(id: string, userId: string) {
		await recordMembership(this.db, userId);
		const company = await this.db.company.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				domain: true,
				website: true,
				description: true,
				logoUrl: true,
				logoDarkUrl: true,
				iconUrl: true,
				iconDarkUrl: true,
				iconTone: true,
				brandColor: true,
				industry: true,
				subIndustry: true,
				city: true,
				stateCode: true,
				country: true,
				countryCode: true,
				phone: true,
				email: true,
				linkedinUrl: true,
				twitterUrl: true,
				githubUrl: true,
				pricingUrl: true,
				careersUrl: true,
				enrichmentStatus: true,
				enrichedAt: true,
				enrichmentError: true,
				source: true,
				createdAt: true,
				archivedAt: true,
				owner: { select: OWNER_SELECT },
				primaryContact: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						title: true,
					},
				},
				contacts: {
					orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						title: true,
						imageUrl: true,
						owner: { select: OWNER_SELECT },
					},
				},
				deals: {
					orderBy: [{ stage: "asc" }, { expectedCloseDate: "asc" }],
					select: {
						id: true,
						name: true,
						stage: true,
						amount: true,
						currency: true,
						baseAmount: true,
						expectedCloseDate: true,
						owner: { select: OWNER_SELECT },
					},
				},
			},
		});

		if (!company) {
			throw new NotFoundException(`No company with id ${id}.`);
		}

		const {
			deals,
			primaryContact,
			enrichedAt,
			createdAt,
			archivedAt,
			...rest
		} = company;

		return {
			...rest,
			fields: await this.fields.valuesFor("COMPANY", id),
			queued: isAiEnabled() && (await this.queue.isQueued({ companyId: id })),
			ai: aiFeaturePolicy(),
			createdAt: createdAt.toISOString(),
			archivedAt: archivedAt?.toISOString() ?? null,
			enrichedAt: enrichedAt?.toISOString() ?? null,
			primaryContactId: primaryContact?.id ?? null,
			primaryContact,
			reportingCurrency: await this.conversion.reportingCurrency(),
			deals: deals.map((deal) => ({
				...deal,
				amount: undefined,
				baseAmount: undefined,
				amountCents: toCents(deal.amount),
				baseAmountCents: toCents(deal.baseAmount),
				expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
			})),
		};
	}

	async options(q: string, userId: string) {
		await recordMembership(this.db, userId);
		return this.db.company.findMany({
			where: { AND: [this.searchFilter(q), { archivedAt: null }] },
			select: { id: true, name: true, domain: true, iconUrl: true },
			orderBy: { name: "asc" },
			take: 100,
		});
	}

	async create(input: CompanyCreateInput, userId: string) {
		await recordMembership(this.db, userId);
		const domain = normalizeDomain(input.domain);

		if (domain) {
			const existing = await this.db.company.findFirst({
				where: { domain, archivedAt: null },
				select: { id: true, name: true },
			});
			if (existing) {
				throw new ConflictException(
					`${existing.name} already uses the domain ${domain}.`,
				);
			}
		}

		const company = await this.agent.withCrmEvents(async (tx, emit) => {
			const role = await recordMembership(tx, userId, { lock: true });
			const ownerId = await recordOwner(
				tx,
				userId,
				role,
				input.ownerId === undefined ||
					(role === "member" && input.ownerId === null)
					? userId
					: input.ownerId,
			);
			const created = await tx.company.create({
				data: {
					name: input.name.trim(),
					domain,
					website: domain ? `https://${domain}` : null,
					ownerId,
					enrichmentStatus: isAiEnabled() ? "PENDING" : "SKIPPED",
				},
				select: { id: true, name: true, domain: true, createdAt: true },
			});
			await emit({
				type: "company.created",
				record: { kind: "company", id: created.id },
				occurredAt: created.createdAt,
				data: { name: created.name, domain: created.domain },
			});
			return created;
		});

		this.logger.log({
			message: "Company created",
			companyId: company.id,
			domain: company.domain,
		});

		if (isAiEnabled()) {
			await this.agent.companyCreated(company.id);
			void this.favicon.backfill(company.id, company.domain);
			void this.fields.queueBackfillForNewRecord("COMPANY", company.id);
		}

		return { id: company.id, name: company.name, domain: company.domain };
	}

	async update(id: string, input: CompanyUpdateInput, userId: string) {
		const data: Prisma.CompanyUpdateInput = {};

		if (input.name !== undefined) data.name = input.name.trim();
		if (input.website !== undefined) data.website = blankToNull(input.website);
		if (input.description !== undefined) {
			data.description = blankToNull(input.description);
		}
		if (input.industry !== undefined)
			data.industry = blankToNull(input.industry);
		if (input.city !== undefined) data.city = blankToNull(input.city);
		if (input.stateCode !== undefined) {
			data.stateCode = blankToNull(input.stateCode);
		}
		if (input.country !== undefined) data.country = blankToNull(input.country);
		if (input.phone !== undefined) data.phone = blankToNull(input.phone);
		if (input.email !== undefined) data.email = blankToNull(input.email);
		if (input.linkedinUrl !== undefined) {
			data.linkedinUrl = blankToNull(input.linkedinUrl);
		}
		if (input.ownerId !== undefined) {
			data.owner = input.ownerId
				? { connect: { id: input.ownerId } }
				: { disconnect: true };
		}

		if (input.domain !== undefined) {
			const domain = normalizeDomain(input.domain);
			if (input.domain.trim() && !domain) {
				throw new BadRequestException(
					`"${input.domain}" is not a domain — try something like "stripe.com".`,
				);
			}
			data.domain = domain;
		}

		try {
			const updated = await this.db.$transaction(async (tx) => {
				const { role } = await authorizedRecord(
					tx,
					"company",
					id,
					userId,
					"edit",
				);
				if (input.ownerId !== undefined)
					await recordOwner(tx, userId, role, input.ownerId || null);
				if (input.domain !== undefined) {
					const current = await tx.company.findUniqueOrThrow({
						where: { id },
						select: { domain: true },
					});
					if (current.domain !== data.domain) {
						data.enrichmentStatus = isAiEnabled() ? "PENDING" : "SKIPPED";
						data.enrichmentError = null;
						data.iconUrl = null;
						data.iconDarkUrl = null;
						data.iconTone = null;
					}
				}
				if (input.fields) {
					await this.fields.applyValues(tx, "COMPANY", id, input.fields);
				}

				return tx.company.update({
					where: { id },
					data,
					select: { id: true, name: true, domain: true },
				});
			});

			if (isAiEnabled() && data.enrichmentStatus === "PENDING") {
				await this.agent.companyCreated(
					id,
					"Domain changed — anything we knew was about a different company",
				);
				void this.favicon.backfill(id, updated.domain);
			}

			return updated;
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async archive(
		id: string,
		userId: string,
	): Promise<{ id: string; name: string }> {
		try {
			const company = await this.db.$transaction(async (tx) => {
				const { record } = await authorizedRecord(
					tx,
					"company",
					id,
					userId,
					"archive",
				);
				return tx.company.update({
					where: { id },
					data: { archivedAt: record.archivedAt ?? new Date() },
					select: { name: true },
				});
			});

			this.logger.log({ message: "Company archived", companyId: id });

			return { id, name: company.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async restore(
		id: string,
		userId: string,
	): Promise<{ id: string; name: string }> {
		try {
			const company = await this.db.$transaction(async (tx) => {
				await authorizedRecord(tx, "company", id, userId, "restore");
				return tx.company.update({
					where: { id },
					data: { archivedAt: null },
					select: { name: true },
				});
			});

			this.logger.log({ message: "Company restored", companyId: id });

			return { id, name: company.name };
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async purge(
		id: string,
		userId: string,
	): Promise<{ id: string; name: string }> {
		const result = await this.purgeRecord(id, { userId });
		if (!result) throw new NotFoundException(`No company with id ${id}.`);
		return result;
	}

	private async purgeRecord(
		id: string,
		access: { userId: string } | { archivedBefore: Date },
	): Promise<{ id: string; name: string } | null> {
		let deleted: { targets: StampTargets; name: string } | null;

		try {
			deleted = await this.db.$transaction(async (tx) => {
				const guard = "archivedBefore" in access ? access : null;
				if (!guard && "userId" in access)
					await authorizedRecord(tx, "company", id, access.userId, "purge");
				const [row] = await tx.$queryRaw<Array<{ archivedAt: Date | null }>>`
					SELECT "archivedAt" FROM company WHERE id = ${id} FOR UPDATE
				`;

				if (!row) {
					if (guard) return null;
					throw new NotFoundException(`No company with id ${id}.`);
				}
				if (
					guard &&
					(!row.archivedAt || row.archivedAt > guard.archivedBefore)
				) {
					return null;
				}
				const deals = await tx.$queryRaw<
					Array<{ id: string; archivedAt: Date | null }>
				>`SELECT id, "archivedAt" FROM deal WHERE "companyId" = ${id} ORDER BY id FOR UPDATE`;
				if (deals.some((deal) => !deal.archivedAt)) {
					if (guard) return null;
					throw new BadRequestException(
						"Archiva las oportunidades de la empresa antes de eliminarla.",
					);
				}

				const targets = await this.stamp.targetsOf(
					{ OR: [{ companyId: id }, { deal: { companyId: id } }] },
					tx,
				);

				await tx.agentTask.deleteMany({
					where: {
						OR: [
							{ companyId: id },
							{ dealId: { in: deals.map((deal) => deal.id) } },
						],
					},
				});

				const company = await tx.company.delete({
					where: { id },
					select: { name: true },
				});

				return { targets, name: company.name };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		if (!deleted) return null;

		await this.stamp.recomputeAfterDelete(deleted.targets, { companyId: id });

		this.logger.log({
			message: "Company purged",
			companyId: id,
			name: deleted.name,
		});

		return { id, name: deleted.name };
	}

	async purgeExpired(before: Date): Promise<BulkResult> {
		const expired = await this.db.company.findMany({
			where: { archivedAt: { lte: before } },
			select: { id: true },
			take: ARCHIVE.prune.maxBatch,
		});

		return runBulk(
			expired.map((row) => row.id),
			(id) => this.purgeRecord(id, { archivedBefore: before }),
		);
	}

	async bulkAssignOwner(
		input: CompanyBulkOwnerInput,
		userId: string,
	): Promise<BulkResult> {
		await recordMembership(this.db, userId, { administrative: true });
		await this.db.$transaction(async (tx) => {
			const role = await recordMembership(tx, userId, {
				lock: true,
				administrative: true,
			});
			await recordOwner(tx, userId, role, input.ownerId || null);
		});
		return runBulk(input.ids, (id) =>
			this.update(id, { ownerId: input.ownerId }, userId),
		);
	}

	async bulkEnrich(ids: string[], userId: string): Promise<BulkResult> {
		requireApiAiEnabled();
		await recordMembership(this.db, userId);
		return runBulk(ids, (id) => this.enrich(id, userId));
	}

	async bulkArchive(ids: string[], userId: string): Promise<BulkResult> {
		await recordMembership(this.db, userId);
		return runBulk(ids, (id) => this.archive(id, userId));
	}

	async bulkRestore(ids: string[], userId: string): Promise<BulkResult> {
		await recordMembership(this.db, userId);
		return runBulk(ids, (id) => this.restore(id, userId));
	}

	async bulkPurge(ids: string[], userId: string): Promise<BulkResult> {
		await recordMembership(this.db, userId, { ownerOnly: true });
		return runBulk(ids, (id) => this.purge(id, userId));
	}

	async enrich(
		id: string,
		userId: string,
	): Promise<{ id: string; queued: boolean }> {
		requireApiAiEnabled();
		const queued = await this.db.$transaction(async (tx) => {
			await authorizedRecord(tx, "company", id, userId, "edit");
			requireApiAiEnabled();
			const queued = await this.agent.companyRequested(
				id,
				"A rep asked for a fresh look",
				tx,
			);
			if (queued && isAiEnabled())
				await tx.company.update({
					where: { id },
					data: { enrichmentStatus: "PENDING", enrichmentError: null },
				});
			return queued;
		});
		if (queued) this.agent.drainQueues();
		return { id, queued: queued && isAiEnabled() };
	}

	async research(id: string, actingUserId: string) {
		requireApiAiEnabled();
		const queued = await this.db.$transaction(async (tx) => {
			await authorizedRecord(tx, "company", id, actingUserId, "edit");
			requireApiAiEnabled();
			const company = await tx.company.findUniqueOrThrow({
				where: { id },
				select: { domain: true },
			});
			if (!company.domain)
				throw new BadRequestException(
					"Añade un dominio antes de solicitar investigación.",
				);
			return this.agent.companyRequested(
				id,
				`Briefing requested by a rep (${actingUserId})`,
				tx,
			);
		});
		if (queued) this.agent.drainQueues();

		return { ok: true as const, queued: queued && isAiEnabled() };
	}

	async setPrimaryContact(
		companyId: string,
		contactId: string | null,
		userId: string,
	) {
		try {
			return await this.db.$transaction(async (tx) => {
				await authorizedRecord(tx, "company", companyId, userId, "edit");
				if (contactId) {
					const [contact] = await tx.$queryRaw<
						Array<{ companyId: string | null; archivedAt: Date | null }>
					>`SELECT "companyId", "archivedAt" FROM contact WHERE id = ${contactId} FOR SHARE`;
					if (!contact) throw new NotFoundException("El contacto no existe.");
					if (contact.companyId !== companyId || contact.archivedAt)
						throw new BadRequestException(
							"Selecciona un contacto activo de la misma empresa.",
						);
				}
				return tx.company.update({
					where: { id: companyId },
					data: { primaryContactId: contactId },
					select: { id: true, primaryContactId: true },
				});
			});
		} catch (error) {
			throw this.translate(error, companyId);
		}
	}

	private searchFilter(q: string): Prisma.CompanyWhereInput {
		const term = q.trim();
		if (!term) return {};

		return {
			OR: [
				{ name: { contains: term, mode: "insensitive" } },
				{ domain: { contains: term, mode: "insensitive" } },
			],
		};
	}

	private buildWhere(
		input: CompanyListInput,
		filterableFields: FieldDefinitionWithOptions[],
	): Prisma.CompanyWhereInput {
		const and: Prisma.CompanyWhereInput[] = [
			this.searchFilter(input.q),
			archivedFilter(input.archived),
			...this.fields.fieldFilters(filterableFields, input.fields),
		];

		const owner = ownerFilter<Prisma.CompanyWhereInput>(input.owner);
		if (owner) and.push(owner);

		if (input.industry.length > 0)
			and.push({ industry: { in: input.industry } });
		if (input.enrichment.length > 0) {
			and.push({
				enrichmentStatus: { in: input.enrichment as EnrichmentStatus[] },
			});
		}
		if (input.source.length > 0) {
			and.push({ source: { in: input.source as RecordSource[] } });
		}

		const activity = activityFilter(input.activity);
		if (activity) and.push(activity);

		return { AND: and };
	}

	private async facetCounts(
		input: CompanyListInput,
		filterableFields: FieldDefinitionWithOptions[],
	) {
		const where = {
			AND: [this.searchFilter(input.q), archivedFilter(input.archived)],
		};

		const [owners, industries, enrichment, sources, activity, fieldFacets] =
			await Promise.all([
				this.db.company.groupBy({
					by: ["ownerId"],
					where,
					_count: { _all: true },
				}),
				this.db.company.groupBy({
					by: ["industry"],
					where,
					_count: { _all: true },
				}),
				this.db.company.groupBy({
					by: ["enrichmentStatus"],
					where,
					_count: { _all: true },
				}),
				this.db.company.groupBy({
					by: ["source"],
					where,
					_count: { _all: true },
				}),
				activityFacetCounts((activityWhere) =>
					this.db.company.count({ where: { AND: [where, activityWhere] } }),
				),
				this.fields.filterFacetCounts("COMPANY", where, filterableFields),
			]);

		return {
			owner: countsByKey(owners, "ownerId", FACET_UNASSIGNED),
			industry: countsByKey(industries, "industry"),
			enrichment: countsByKey(enrichment, "enrichmentStatus"),
			source: countsByKey(sources, "source"),
			activity,
			...Object.fromEntries(
				Object.entries(fieldFacets).map(([key, counts]) => [
					`field:${key}`,
					counts,
				]),
			),
		};
	}

	private translate(cause: unknown, id: string): never {
		if (cause instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (cause.code === "P2025") {
				throw new NotFoundException(`No company with id ${id}.`);
			}
			if (cause.code === "P2002") {
				throw new ConflictException(
					"Another company already uses that domain.",
				);
			}
		}
		throw cause;
	}
}
