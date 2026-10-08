import { z } from "zod";

export const PIPELINE_LIMITS = { stages: 30, name: 100, reason: 2000 } as const;
export const pipelineOutcome = z.enum(["OPEN", "WON", "LOST", "DISQUALIFIED"]);
export const pipelineStageInput = z.object({
	id: z.string().min(1).optional(),
	name: z.string().trim().min(1).max(PIPELINE_LIMITS.name),
	outcome: pipelineOutcome,
});
export const pipelineConfigureInput = z.object({
	id: z.string().min(1).optional(),
	expectedRevision: z.number().int().positive().optional(),
	name: z.string().trim().min(1).max(PIPELINE_LIMITS.name),
	isDefault: z.boolean().default(false),
	stages: z.array(pipelineStageInput).min(3).max(PIPELINE_LIMITS.stages),
});
export type PipelineConfigureInput = z.infer<typeof pipelineConfigureInput>;
export const pipelineIdInput = z.object({ id: z.string().min(1) });
export const pipelineStageOutput = z.object({
	id: z.string(),
	name: z.string(),
	position: z.number(),
	outcome: pipelineOutcome,
	legacyStage: z.enum([
		"DEMO_BOOKED",
		"QUALIFIED_TO_BUY",
		"DECISION_MAKER_BOUGHT_IN",
		"CONTRACT_SENT",
		"CLOSED_WON",
		"CLOSED_LOST",
		"UNQUALIFIED_TO_BUY",
	]),
});
export const pipelineOutput = z.object({
	id: z.string(),
	name: z.string(),
	revision: z.number(),
	isDefault: z.boolean(),
	stages: z.array(pipelineStageOutput),
});
export const pipelinesListOutput = z.object({
	canManage: z.boolean(),
	rows: z.array(pipelineOutput),
});
export const pipelineArchivedOutput = z.object({ id: z.string() });
export const dealStageHistoryOutput = z.array(
	z.object({
		id: z.string(),
		actorId: z.string(),
		fromStageId: z.string().nullable(),
		fromStageName: z.string().nullable(),
		fromOutcome: pipelineOutcome.nullable(),
		fromPipelineId: z.string().nullable(),
		fromPipelineName: z.string().nullable(),
		toStageId: z.string(),
		toStageName: z.string(),
		toOutcome: pipelineOutcome,
		toPipelineId: z.string(),
		toPipelineName: z.string(),
		reason: z.string().nullable(),
		occurredAt: z.string(),
	}),
);
