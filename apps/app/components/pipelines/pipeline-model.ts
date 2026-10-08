import { z } from "zod";
import { PIPELINE_EDITOR } from "./pipeline-config";

export const outcomeSchema = z.enum(["OPEN", "WON", "LOST", "DISQUALIFIED"]);
export type PipelineOutcome = z.infer<typeof outcomeSchema>;

const stageViewSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	position: z.number(),
	outcome: outcomeSchema,
});

const pipelineViewSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	revision: z.number().int().positive(),
	isDefault: z.boolean(),
	stages: z.array(stageViewSchema),
});

export type PipelineView = z.infer<typeof pipelineViewSchema>;
export type PipelineStageView = z.infer<typeof stageViewSchema>;

export const OUTCOME_OPTIONS: { value: PipelineOutcome; label: string }[] = [
	{ value: "OPEN", label: "Abierta" },
	{ value: "WON", label: "Ganada" },
	{ value: "LOST", label: "Perdida" },
	{ value: "DISQUALIFIED", label: "Descartada" },
];

export function outcomeLabel(outcome: PipelineOutcome) {
	return (
		OUTCOME_OPTIONS.find((option) => option.value === outcome)?.label ?? outcome
	);
}

const draftStageSchema = z.object({
	key: z.string().min(1),
	id: z.string().min(1).optional(),
	name: z.string(),
	outcome: outcomeSchema,
});

const draftSchema = z.object({
	id: z.string().min(1).optional(),
	expectedRevision: z.number().int().positive().optional(),
	name: z.string(),
	isDefault: z.boolean(),
	stages: z.array(draftStageSchema),
	nextStageNumber: z.number().int().positive(),
});

export type PipelineDraft = z.infer<typeof draftSchema>;
export type StageDraft = z.infer<typeof draftStageSchema>;

const nameSchema = z
	.string()
	.trim()
	.min(1, "Escribe un nombre.")
	.max(
		PIPELINE_EDITOR.nameLength,
		`Usa hasta ${PIPELINE_EDITOR.nameLength} caracteres.`,
	);

const configureSchema = z.object({
	id: z.string().min(1).optional(),
	expectedRevision: z.number().int().positive().optional(),
	name: nameSchema,
	isDefault: z.boolean(),
	stages: z
		.array(
			z.object({
				id: z.string().min(1).optional(),
				name: nameSchema,
				outcome: outcomeSchema,
			}),
		)
		.min(PIPELINE_EDITOR.stageMinimum)
		.max(PIPELINE_EDITOR.stageLimit),
});

export function pipelineDraft(
	source: PipelineView | null,
	isFirst = false,
): PipelineDraft {
	if (source) {
		return {
			id: source.id,
			expectedRevision: source.revision,
			name: source.name,
			isDefault: source.isDefault,
			nextStageNumber: 1,
			stages: orderedStages(source).map((stage) => ({
				key: stage.id,
				id: stage.id,
				name: stage.name,
				outcome: stage.outcome,
			})),
		};
	}
	return {
		name: "",
		isDefault: isFirst,
		nextStageNumber: 4,
		stages: [
			{ key: "new:1", name: "Primer contacto", outcome: "OPEN" },
			{ key: "new:2", name: "Ganada", outcome: "WON" },
			{ key: "new:3", name: "Perdida", outcome: "LOST" },
		],
	};
}

export function addDraftStage(draft: PipelineDraft): PipelineDraft {
	if (draft.stages.length >= PIPELINE_EDITOR.stageLimit) return draft;
	return {
		...draft,
		nextStageNumber: draft.nextStageNumber + 1,
		stages: [
			...draft.stages,
			{
				key: `new:${draft.nextStageNumber}`,
				name: "",
				outcome: "OPEN",
			},
		],
	};
}

export function reorderStage(
	draft: PipelineDraft,
	key: string,
	direction: -1 | 1,
): PipelineDraft {
	const position = draft.stages.findIndex((stage) => stage.key === key);
	const destination = position + direction;
	if (position < 0 || destination < 0 || destination >= draft.stages.length)
		return draft;
	const stages = [...draft.stages];
	const source = stages[position];
	const target = stages[destination];
	if (!source || !target) return draft;
	stages[position] = target;
	stages[destination] = source;
	return { ...draft, stages };
}

export function pipelineDraftIssues(
	draft: PipelineDraft,
	source: PipelineView | null,
	canManage: boolean,
) {
	const issues: string[] = [];
	if (!canManage)
		issues.push("Sólo un propietario o administrador configura pipelines.");
	if (!nameSchema.safeParse(draft.name).success)
		issues.push("El pipeline necesita un nombre de 1 a 100 caracteres.");
	if (
		draft.stages.length < PIPELINE_EDITOR.stageMinimum ||
		draft.stages.length > PIPELINE_EDITOR.stageLimit
	) {
		issues.push("El pipeline necesita entre 3 y 30 etapas.");
	}
	const names = draft.stages.map((stage) =>
		stage.name.trim().toLocaleLowerCase("es-MX"),
	);
	if (draft.stages.some((stage) => !nameSchema.safeParse(stage.name).success)) {
		issues.push("Cada etapa necesita un nombre de 1 a 100 caracteres.");
	}
	if (new Set(names).size !== names.length)
		issues.push("Los nombres de etapa no se repiten.");
	for (const outcome of ["OPEN", "WON", "LOST"] as const) {
		if (!draft.stages.some((stage) => stage.outcome === outcome))
			issues.push(
				`Incluye una etapa ${outcomeLabel(outcome).toLocaleLowerCase("es-MX")}.`,
			);
	}
	const ids = draft.stages.flatMap((stage) => (stage.id ? [stage.id] : []));
	if (new Set(ids).size !== ids.length)
		issues.push("Los identificadores de etapa no se repiten.");
	if (
		new Set(draft.stages.map((stage) => stage.key)).size !== draft.stages.length
	)
		issues.push("Los controles de etapa necesitan identificadores distintos.");
	if (source) {
		if (draft.id !== source.id || draft.expectedRevision !== source.revision) {
			issues.push("La revisión cambia. Recarga antes de guardar.");
		}
		if (source.isDefault && !draft.isDefault)
			issues.push(
				"Selecciona otro pipeline predeterminado antes de desactivar éste.",
			);
		for (const stage of draft.stages) {
			if (!stage.id) continue;
			const original = source.stages.find((entry) => entry.id === stage.id);
			if (!original) issues.push("Una etapa no pertenece al pipeline.");
			else if (stage.outcome !== original.outcome)
				issues.push("El resultado de una etapa existente es inmutable.");
		}
	} else if (draft.id || ids.length || draft.expectedRevision) {
		issues.push(
			"Un pipeline nuevo no reutiliza identificadores ni revisiones.",
		);
	}
	return [...new Set(issues)];
}

export function configurationInput(draft: PipelineDraft) {
	return configureSchema.parse({
		id: draft.id,
		expectedRevision: draft.expectedRevision,
		name: draft.name,
		isDefault: draft.isDefault,
		stages: draft.stages.map(({ id, name, outcome }) => ({
			id,
			name,
			outcome,
		})),
	});
}

export function orderedStages(pipeline: Pick<PipelineView, "stages">) {
	return [...pipeline.stages].sort(
		(a, b) => a.position - b.position || a.id.localeCompare(b.id),
	);
}

export function initialPipelineSelection(
	rows: PipelineView[],
	requestedId?: string,
) {
	const pipeline = requestedId
		? rows.find((entry) => entry.id === requestedId)
		: (rows.find((entry) => entry.isDefault) ?? rows[0]);
	const stage =
		pipeline &&
		orderedStages(pipeline).find((entry) => entry.outcome === "OPEN");
	return pipeline && stage
		? { pipelineId: pipeline.id, pipelineStageId: stage.id }
		: null;
}

export function stageRequiresReason(outcome: PipelineOutcome) {
	return outcome === "LOST" || outcome === "DISQUALIFIED";
}

export function stageChangeIssues({
	rows,
	pipelineId,
	pipelineStageId,
	currentPipelineId,
	currentStageId,
	confirmedMove,
	reason,
}: {
	rows: PipelineView[];
	pipelineId: string;
	pipelineStageId: string;
	currentPipelineId?: string;
	currentStageId?: string;
	confirmedMove: boolean;
	reason: string;
}) {
	const issues: string[] = [];
	const pipeline = rows.find((entry) => entry.id === pipelineId);
	const stage = pipeline?.stages.find((entry) => entry.id === pipelineStageId);
	if (!pipeline || !stage)
		issues.push("Selecciona una etapa de un pipeline activo.");
	if (stage?.id === currentStageId)
		issues.push("Selecciona una etapa distinta.");
	if (currentPipelineId && pipelineId !== currentPipelineId && !confirmedMove) {
		issues.push("Confirma el movimiento a otro pipeline.");
	}
	if (stage && stageRequiresReason(stage.outcome) && !reason.trim())
		issues.push("Escribe el motivo del cierre.");
	if (reason.trim().length > PIPELINE_EDITOR.reasonLength)
		issues.push("El motivo admite hasta 2000 caracteres.");
	return issues;
}
