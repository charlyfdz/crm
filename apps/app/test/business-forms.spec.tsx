import { describe, expect, it } from "bun:test";
import { formatMoney, formatMoneyCompact } from "@crm/ui/lib/format";
import { MAX_AMOUNT_CENTS, parseDealAmount } from "@crm/validation/deal-money";
import { renderToStaticMarkup } from "react-dom/server";
import { dealsSearchParams } from "../app/(app)/[slug]/deals/deals-search-params";
import { ActivityTaskCreate } from "../components/crm/activity-tasks/activity-task-create";
import { ActivityTaskEditor } from "../components/crm/activity-tasks/activity-task-editor";
import {
	type TaskView,
	taskAccess,
	taskDraft,
	taskPatch,
	taskValues,
} from "../components/crm/activity-tasks/task-form-state";
import {
	addDraftStage,
	configurationInput,
	initialPipelineSelection,
	orderedStages,
	type PipelineView,
	pipelineDraft,
	pipelineDraftIssues,
	reorderStage,
	stageChangeIssues,
} from "../components/pipelines/pipeline-model";

const pipeline: PipelineView = {
	id: "pipeline-test",
	name: "Servicios ficticios",
	revision: 2,
	isDefault: true,
	stages: [
		{ id: "won", name: "Ganada", position: 2, outcome: "WON" },
		{ id: "contact", name: "Contacto", position: 0, outcome: "OPEN" },
		{ id: "lost", name: "Perdida", position: 3, outcome: "LOST" },
		{ id: "proposal", name: "Propuesta", position: 1, outcome: "OPEN" },
	],
};
const task: TaskView = {
	id: "task-test",
	subject: "Revisar propuesta ficticia",
	body: "Datos de prueba",
	dueAt: "2026-10-03T17:15:43.123Z",
	completedAt: null,
	createdBy: { id: "author", name: "Autor ficticio" },
	assignee: { id: "rep", name: "Responsable ficticio" },
	priority: 2,
};

describe("pipeline configuration and stage selection", () => {
	it("orders stable identifiers without changing the original response", () => {
		expect(orderedStages(pipeline).map((stage) => stage.id)).toEqual([
			"contact",
			"proposal",
			"won",
			"lost",
		]);
		expect(pipeline.stages[0]?.id).toBe("won");
	});
	it("keeps identifiers and the expected revision when renaming", () => {
		const draft = pipelineDraft(pipeline);
		draft.name = " Nuevo nombre ";
		const input = configurationInput(draft);
		expect(input.name).toBe("Nuevo nombre");
		expect(input.id).toBe(pipeline.id);
		expect(input.expectedRevision).toBe(2);
		expect(input.stages.map((stage) => stage.id)).toEqual([
			"contact",
			"proposal",
			"won",
			"lost",
		]);
		expect(pipelineDraftIssues(draft, pipeline, true)).toEqual([]);
	});
	it("detects concurrent configuration changes without replacing the draft", () => {
		const draft = pipelineDraft(pipeline);
		expect(
			pipelineDraftIssues(draft, { ...pipeline, revision: 3 }, true),
		).toContain("La revisión cambia. Recarga antes de guardar.");
		expect(draft.expectedRevision).toBe(2);
	});
	it("blocks existing outcomes and duplicate or foreign identifiers", () => {
		const draft = pipelineDraft(pipeline);
		const stage = draft.stages[0];
		if (!stage) throw new Error("Missing fixture stage");
		stage.outcome = "WON";
		expect(pipelineDraftIssues(draft, pipeline, true)).toContain(
			"El resultado de una etapa existente es inmutable.",
		);
		stage.id = "foreign";
		expect(pipelineDraftIssues(draft, pipeline, true)).toContain(
			"Una etapa no pertenece al pipeline.",
		);
		draft.stages.push({ ...stage });
		expect(pipelineDraftIssues(draft, pipeline, true)).toContain(
			"Los identificadores de etapa no se repiten.",
		);
	});
	it("rejects normalized duplicate names and missing outcomes", () => {
		const draft = pipelineDraft(null);
		draft.name = "Prueba";
		const stage = draft.stages[1];
		if (!stage) throw new Error("Missing fixture stage");
		stage.name = " PRIMER CONTACTO ";
		stage.outcome = "OPEN";
		const issues = pipelineDraftIssues(draft, null, true);
		expect(issues).toContain("Los nombres de etapa no se repiten.");
		expect(issues).toContain("Incluye una etapa ganada.");
	});
	it("rejects configuration by a non-manager", () => {
		expect(
			pipelineDraftIssues(pipelineDraft(pipeline), pipeline, false),
		).toContain("Sólo un propietario o administrador configura pipelines.");
	});
	it("cannot disable the default without selecting another default", () => {
		const draft = { ...pipelineDraft(pipeline), isDefault: false };
		expect(pipelineDraftIssues(draft, pipeline, true)).toContain(
			"Selecciona otro pipeline predeterminado antes de desactivar éste.",
		);
	});
	it("moves rows by key and preserves all stable identifiers", () => {
		const draft = pipelineDraft(pipeline);
		const moved = reorderStage(draft, "proposal", -1);
		expect(moved.stages.map((stage) => stage.id)).toEqual([
			"proposal",
			"contact",
			"won",
			"lost",
		]);
		expect(reorderStage(moved, "proposal", -1)).toBe(moved);
		expect(draft.stages[0]?.id).toBe("contact");
	});
	it("allocates new draft keys without recycling removed keys", () => {
		const draft = addDraftStage(pipelineDraft(null));
		const removed = {
			...draft,
			stages: draft.stages.filter((stage) => stage.key !== "new:4"),
		};
		expect(addDraftStage(removed).stages.at(-1)?.key).toBe("new:5");
	});
	it("starts at the first open stage of the selected or default process", () => {
		expect(initialPipelineSelection([pipeline])).toEqual({
			pipelineId: pipeline.id,
			pipelineStageId: "contact",
		});
		expect(initialPipelineSelection([pipeline], "missing")).toBeNull();
		expect(initialPipelineSelection([])).toBeNull();
	});
	it("distinguishes two open stages instead of treating them as an identical legacy enum", () => {
		expect(
			stageChangeIssues({
				rows: [pipeline],
				pipelineId: pipeline.id,
				pipelineStageId: "proposal",
				currentPipelineId: pipeline.id,
				currentStageId: "contact",
				confirmedMove: false,
				reason: "",
			}),
		).toEqual([]);
	});
	it("requires confirmation across processes and reasons for losses", () => {
		const issues = stageChangeIssues({
			rows: [pipeline],
			pipelineId: pipeline.id,
			pipelineStageId: "lost",
			currentPipelineId: "other",
			currentStageId: "other-stage",
			confirmedMove: false,
			reason: "",
		});
		expect(issues).toContain("Confirma el movimiento a otro pipeline.");
		expect(issues).toContain("Escribe el motivo del cierre.");
	});
	it("rejects unchanged stages, foreign stages and oversized reasons", () => {
		const input = {
			rows: [pipeline],
			pipelineId: pipeline.id,
			pipelineStageId: "contact",
			currentStageId: "contact",
			confirmedMove: true,
			reason: "",
		};
		expect(stageChangeIssues(input)).toContain(
			"Selecciona una etapa distinta.",
		);
		expect(
			stageChangeIssues({ ...input, pipelineStageId: "foreign" }),
		).toContain("Selecciona una etapa de un pipeline activo.");
		expect(stageChangeIssues({ ...input, reason: "x".repeat(2001) })).toContain(
			"El motivo admite hasta 2000 caracteres.",
		);
	});
	it("shares the native repeated-array parser between URL state and API input", async () => {
		const values = await dealsSearchParams.load(
			new URLSearchParams("pipelineStageIds=contact&pipelineStageIds=proposal"),
		);
		expect(dealsSearchParams.toInput(values).pipelineStageIds).toEqual([
			"contact",
			"proposal",
		]);
		expect(dealsSearchParams.defaultInput().pipelineStageIds).toEqual([]);
	});
});

describe("task drafts and access", () => {
	for (const role of ["owner", "admin", "member"]) {
		it(`${role} edits authored or assigned tasks`, () => {
			expect(taskAccess(task, "author", role).canEdit).toBe(true);
			expect(taskAccess(task, "rep", role).canEdit).toBe(true);
			expect(taskAccess(task, "other", role).canEdit).toBe(role !== "member");
			expect(taskAccess(task, "author", role).canAssign).toBe(
				role !== "member",
			);
		});
	}
	for (const role of ["viewer", "", "invented"]) {
		it(`${role || "missing role"} has no write access`, () =>
			expect(taskAccess(task, "author", role)).toEqual({
				canEdit: false,
				canAssign: false,
			}));
	}
	it("assigns new tasks to the acting user without a client author field", () => {
		const values = taskValues({
			...taskDraft(null, "rep"),
			subject: " Nueva tarea ",
		});
		expect(values.assigneeId).toBe("rep");
		expect(values.subject).toBe("Nueva tarea");
		expect(values).not.toHaveProperty("createdById");
	});
	it("preserves original seconds when no deadline change exists", () => {
		expect(taskPatch(task, taskDraft(task, "author"))).toEqual({ id: task.id });
	});
	it("removes the deadline explicitly, without substituting now", () => {
		expect(
			taskPatch(task, { ...taskDraft(task, "author"), dueUtc: "" }),
		).toEqual({ id: task.id, dueAt: null });
	});
	it("sets an explicit UTC deadline, priority and assignee without changing author", () => {
		const patch = taskPatch(task, {
			...taskDraft(task, "author"),
			dueUtc: "2026-10-04T10:30",
			assigneeId: "colleague",
			priority: 3,
		});
		expect(patch).toEqual({
			id: task.id,
			dueAt: "2026-10-04T10:30:00.000Z",
			assigneeId: "colleague",
			priority: 3,
		});
		expect(patch).not.toHaveProperty("createdById");
	});
	it("allows an author to edit an unassigned task without inventing assignment", () => {
		const unassigned = { ...task, assignee: null };
		expect(
			taskPatch(unassigned, {
				...taskDraft(unassigned, "author"),
				body: "Actualizada",
			}),
		).toEqual({ id: task.id, body: "Actualizada" });
		expect(() =>
			taskValues({ ...taskDraft(null, ""), subject: "Prueba" }),
		).toThrow();
	});
	it("never sends an empty reassignment for an assigned task", () => {
		expect(() =>
			taskPatch(task, { ...taskDraft(task, "author"), assigneeId: "" }),
		).toThrow();
	});
	for (const dueUtc of ["2026-02-30T12:00", "yesterday", "2026-10-03T12:00Z"]) {
		it(`rejects invalid UTC deadline ${dueUtc}`, () =>
			expect(() =>
				taskValues({ ...taskDraft(task, "author"), dueUtc }),
			).toThrow());
	}
	it("renders labelled fields and an explicit timezone without external dependencies", () => {
		const markup = renderToStaticMarkup(
			<ActivityTaskCreate
				anchor={{ dealId: "deal-test" }}
				actorId="rep"
				workspaceRole="member"
				members={[{ id: "rep", name: "Responsable ficticio" }]}
				onCreate={async () => {}}
			/>,
		);
		for (const label of [
			"Tarea",
			"Detalles",
			"Fecha y hora UTC",
			"Prioridad",
			"Responsable",
			"Crear tarea",
		])
			expect(markup).toContain(label);
		expect(markup).toContain('type="datetime-local"');
		expect(markup).toContain("UTC no es la hora local");
		expect(markup).not.toContain("<img");
	});
	it("shows readonly access without edit or completion controls for unrelated members", () => {
		const markup = renderToStaticMarkup(
			<ActivityTaskEditor
				task={task}
				actorId="other"
				workspaceRole="member"
				members={[]}
				onUpdate={async () => {}}
				onComplete={async () => {}}
			/>,
		);
		expect(markup).toContain("Tarea de sólo lectura");
		expect(markup).not.toContain("Guardar tarea");
		expect(markup).not.toContain("Completar tarea");
	});
	it("labels reopening explicitly and keeps the author visible", () => {
		const markup = renderToStaticMarkup(
			<ActivityTaskEditor
				task={{ ...task, completedAt: "2026-10-03T18:00:00.000Z" }}
				actorId="author"
				workspaceRole="member"
				members={[]}
				onUpdate={async () => {}}
				onComplete={async () => {}}
			/>,
		);
		expect(markup).toContain("Reabrir tarea");
		expect(markup).toContain("Autor ficticio");
	});
});

describe("money input and deterministic presentation", () => {
	for (const [input, cents] of [
		["", null],
		["  ", null],
		["0", 0],
		["0.00", 0],
		["1.05", 105],
		["12345.67", 1234567],
		["0001.2", 120],
		["999999999999.99", MAX_AMOUNT_CENTS],
	] as const) {
		it(`parses ${JSON.stringify(input)} without floating-point rounding`, () =>
			expect(parseDealAmount(input)).toBe(cents));
	}
	for (const input of [
		"1abc",
		"1.005",
		"-1",
		"NaN",
		"Infinity",
		"1e5",
		"1,234.56",
		"1,2",
		"1000000000000.00",
	]) {
		it(`rejects ${input} instead of storing a partial or rounded value`, () =>
			expect(() => parseDealAmount(input)).toThrow());
	}
	it("produces fixed currency text and preserves a measured zero", () => {
		expect(formatMoney(0, "USD")).toBe("$0");
		expect(formatMoney(105, "USD")).toBe("$1.05");
		expect(formatMoney(105, "MXN")).toBe("MX$1.05");
		expect(formatMoneyCompact(100000, "USD")).toBe("$1K");
	});
});
