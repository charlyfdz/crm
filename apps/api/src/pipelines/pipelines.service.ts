import { WORKSPACE_ID } from "@crm/auth";
import {
	type Db,
	type DealOutcome,
	type DealStage,
	type Prisma,
	Prisma as PrismaNamespace,
} from "@crm/db";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type { PipelineConfigureInput } from "./pipelines.contracts";

const STAGE_SELECT = {
	id: true,
	pipelineId: true,
	name: true,
	outcome: true,
	legacyStage: true,
	position: true,
	archivedAt: true,
	pipeline: { select: { id: true, name: true, archivedAt: true } },
} as const;
const PIPELINE_SELECT = {
	id: true,
	name: true,
	revision: true,
	isDefault: true,
	stages: {
		where: { archivedAt: null },
		orderBy: [{ position: "asc" }, { id: "asc" }],
		select: {
			id: true,
			name: true,
			position: true,
			outcome: true,
			legacyStage: true,
		},
	},
} satisfies Prisma.PipelineSelect;

export async function lockPipelines(tx: Prisma.TransactionClient) {
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('crm-pipeline-configuration'))`;
}

function legacyStage(outcome: DealOutcome): DealStage {
	return {
		OPEN: "DEMO_BOOKED",
		WON: "CLOSED_WON",
		LOST: "CLOSED_LOST",
		DISQUALIFIED: "UNQUALIFIED_TO_BUY",
	}[outcome] as DealStage;
}

export function validatePipelineDefinition(input: PipelineConfigureInput) {
	const names = input.stages.map((stage) =>
		stage.name.trim().toLocaleLowerCase("es-MX"),
	);
	if (new Set(names).size !== names.length)
		throw new BadRequestException("Las etapas necesitan nombres distintos.");
	for (const outcome of ["OPEN", "WON", "LOST"] as const) {
		if (!input.stages.some((stage) => stage.outcome === outcome))
			throw new BadRequestException(`Falta una etapa ${outcome}.`);
	}
	const ids = input.stages.flatMap((stage) => (stage.id ? [stage.id] : []));
	if (new Set(ids).size !== ids.length)
		throw new BadRequestException("No repitas identificadores de etapa.");
	if (input.id && !input.expectedRevision)
		throw new BadRequestException("La revisión actual es obligatoria.");
	if (!input.id && ids.length)
		throw new BadRequestException(
			"Un pipeline nuevo no reutiliza etapas de otro pipeline.",
		);
}

@Injectable()
export class PipelinesService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async membership(
		userId: string,
		client: Db | Prisma.TransactionClient = this.db,
		administrative = false,
	) {
		if (client !== this.db)
			await client.$queryRaw`SELECT id FROM "member" WHERE "organizationId" = ${WORKSPACE_ID} AND "userId" = ${userId} FOR SHARE`;
		const member = await client.member.findUnique({
			where: {
				organizationId_userId: { organizationId: WORKSPACE_ID, userId },
			},
			select: { role: true, suspendedAt: true },
		});
		if (
			!member ||
			member.suspendedAt ||
			!["owner", "admin", "member"].includes(member.role) ||
			(administrative && !["owner", "admin"].includes(member.role))
		)
			throw new ForbiddenException("No tienes permiso para esta operación.");
		return member.role;
	}

	async list(userId: string) {
		const role = await this.membership(userId);
		return {
			canManage: ["owner", "admin"].includes(role),
			rows: await this.db.pipeline.findMany({
				where: { archivedAt: null },
				orderBy: [{ isDefault: "desc" }, { name: "asc" }],
				select: PIPELINE_SELECT,
			}),
		};
	}

	async configure(input: PipelineConfigureInput, userId: string) {
		await this.membership(userId, this.db, true);
		validatePipelineDefinition(input);
		try {
			return await this.db.$transaction(async (tx) => {
				await lockPipelines(tx);
				await this.membership(userId, tx, true);
				const current = input.id
					? await tx.pipeline.findUnique({
							where: { id: input.id },
							include: { stages: true },
						})
					: null;
				if (input.id && (!current || current.archivedAt))
					throw new NotFoundException("No existe un pipeline activo.");
				if (current && current.revision !== input.expectedRevision)
					throw new ConflictException(
						"Otro usuario cambia el pipeline. Recarga antes de guardar.",
					);
				if (current?.isDefault && !input.isDefault)
					throw new BadRequestException(
						"Selecciona otro pipeline predeterminado antes de desactivar éste.",
					);
				const known = new Map(
					current?.stages.map((stage) => [stage.id, stage]) ?? [],
				);
				for (const stage of input.stages) {
					if (
						stage.id &&
						(!known.has(stage.id) || known.get(stage.id)?.archivedAt)
					)
						throw new BadRequestException(
							"Una etapa no pertenece al pipeline activo.",
						);
					if (stage.id && known.get(stage.id)?.outcome !== stage.outcome)
						throw new BadRequestException(
							"El resultado de una etapa es inmutable. Crea otra etapa y mueve las oportunidades.",
						);
				}
				const removed =
					current?.stages.filter(
						(stage) =>
							!stage.archivedAt &&
							!input.stages.some((submitted) => submitted.id === stage.id),
					) ?? [];
				if (
					removed.length &&
					(await tx.deal.count({
						where: {
							pipelineStageId: { in: removed.map((stage) => stage.id) },
						},
					}))
				)
					throw new ConflictException(
						"Una etapa retirada contiene oportunidades. Muévelas antes de guardar.",
					);
				if (input.isDefault)
					await tx.pipeline.updateMany({
						where: { isDefault: true },
						data: { isDefault: false },
					});
				const data = {
					name: input.name.trim(),
					nameKey: input.name.trim().toLocaleLowerCase("es-MX"),
					isDefault: input.isDefault,
				};
				const pipeline = current
					? await tx.pipeline.update({
							where: { id: current.id },
							data: { ...data, revision: { increment: 1 } },
						})
					: await tx.pipeline.create({ data });
				await tx.pipelineStage.updateMany({
					where: { id: { in: removed.map((stage) => stage.id) } },
					data: { archivedAt: new Date() },
				});
				for (const stage of current?.stages ?? []) {
					if (input.stages.some((submitted) => submitted.id === stage.id))
						await tx.pipelineStage.update({
							where: { id: stage.id },
							data: { nameKey: `reserved:${stage.id}` },
						});
				}
				for (const [position, stage] of input.stages.entries()) {
					const stageData = {
						name: stage.name.trim(),
						nameKey: stage.name.trim().toLocaleLowerCase("es-MX"),
						position,
					};
					if (stage.id)
						await tx.pipelineStage.update({
							where: { id: stage.id },
							data: stageData,
						});
					else
						await tx.pipelineStage.create({
							data: {
								...stageData,
								pipelineId: pipeline.id,
								outcome: stage.outcome,
								legacyStage: legacyStage(stage.outcome),
							},
						});
				}
				return tx.pipeline.findUniqueOrThrow({
					where: { id: pipeline.id },
					select: PIPELINE_SELECT,
				});
			});
		} catch (error) {
			if (
				error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
				error.code === "P2002"
			)
				throw new ConflictException(
					"Ese nombre ya existe. Usa otro nombre de pipeline o etapa.",
				);
			throw error;
		}
	}

	async archive(id: string, userId: string) {
		await this.membership(userId, this.db, true);
		return this.db.$transaction(async (tx) => {
			await lockPipelines(tx);
			await this.membership(userId, tx, true);
			const pipeline = await tx.pipeline.findUnique({ where: { id } });
			if (!pipeline) throw new NotFoundException("No existe el pipeline.");
			if (pipeline.isDefault)
				throw new BadRequestException(
					"El pipeline predeterminado no se archiva.",
				);
			if (await tx.deal.count({ where: { pipelineStage: { pipelineId: id } } }))
				throw new ConflictException(
					"El pipeline contiene oportunidades activas o archivadas.",
				);
			await tx.pipeline.update({
				where: { id },
				data: { archivedAt: new Date(), revision: { increment: 1 } },
			});
			return { id };
		});
	}

	async resolveStage(
		tx: Prisma.TransactionClient,
		requested: {
			pipelineId?: string;
			pipelineStageId?: string;
			stage?: DealStage;
		},
		currentPipelineId?: string,
	) {
		await lockPipelines(tx);
		const pipelineId = requested.pipelineId ?? currentPipelineId;
		const where: Prisma.PipelineStageWhereInput = {
			archivedAt: null,
			pipeline: {
				archivedAt: null,
				...(pipelineId ? { id: pipelineId } : { isDefault: true }),
			},
		};
		if (requested.pipelineStageId) {
			const selected = await tx.pipelineStage.findFirst({
				where: {
					...where,
					id: requested.pipelineStageId,
					pipeline: {
						archivedAt: null,
						...(pipelineId ? { id: pipelineId } : {}),
					},
				},
				select: STAGE_SELECT,
			});
			if (!selected)
				throw new BadRequestException(
					"Selecciona una etapa activa del pipeline indicado.",
				);
			if (requested.stage && requested.stage !== selected.legacyStage)
				throw new BadRequestException(
					"La etapa configurada y la clasificación no coinciden.",
				);
			return selected;
		}
		if (requested.stage) {
			const matches = await tx.pipelineStage.findMany({
				where: { ...where, legacyStage: requested.stage },
				select: STAGE_SELECT,
				orderBy: { position: "asc" },
				take: 2,
			});
			const selected = matches[0];
			if (matches.length !== 1 || !selected)
				throw new BadRequestException(
					"Selecciona la etapa por su identificador. La clasificación no identifica una etapa única.",
				);
			return selected;
		}
		const selected = await tx.pipelineStage.findFirst({
			where: { ...where, outcome: "OPEN" },
			select: STAGE_SELECT,
			orderBy: [{ position: "asc" }, { id: "asc" }],
		});
		if (!selected)
			throw new BadRequestException("El pipeline necesita una etapa abierta.");
		return selected;
	}
}
