import { z } from "zod";
import { TASK_FORM } from "./task-form-config";

export const TASK_PRIORITIES = [
	{ value: 0, label: "Sin prioridad" },
	{ value: 1, label: "Normal" },
	{ value: 2, label: "Alta" },
	{ value: 3, label: "Urgente" },
] as const;

const person = z.object({ id: z.string(), name: z.string() });
const priority = z
	.number()
	.int()
	.min(TASK_FORM.priorityMinimum)
	.max(TASK_FORM.priorityMaximum);
const identifier = z.string().trim().min(1).max(TASK_FORM.identifierLength);

export const taskViewSchema = z.object({
	id: identifier,
	subject: z.string().nullable(),
	body: z.string().nullable(),
	dueAt: z.iso.datetime({ offset: true }).nullable(),
	completedAt: z.iso.datetime({ offset: true }).nullable(),
	createdBy: person,
	assignee: person.nullable(),
	priority,
});

export type TaskView = z.infer<typeof taskViewSchema>;

export const taskDraftSchema = z.object({
	subject: z
		.string()
		.trim()
		.min(1, "Escribe la tarea.")
		.max(
			TASK_FORM.subjectLength,
			`Usa un máximo de ${TASK_FORM.subjectLength} caracteres.`,
		),
	body: z
		.string()
		.trim()
		.max(
			TASK_FORM.bodyLength,
			`Usa un máximo de ${TASK_FORM.bodyLength} caracteres.`,
		),
	dueUtc: z
		.string()
		.refine(
			(value) =>
				value === "" ||
				(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
					z.iso.datetime().safeParse(`${value}:00.000Z`).success),
			"Introduce una fecha y hora UTC válida.",
		),
	assigneeId: z.string().trim().max(TASK_FORM.identifierLength),
	priority,
});

export type TaskDraft = z.infer<typeof taskDraftSchema>;

export const taskValuesSchema = z.object({
	subject: z.string().trim().min(1).max(TASK_FORM.subjectLength),
	body: z.string().trim().max(TASK_FORM.bodyLength).nullable(),
	dueAt: z.iso.datetime().nullable(),
	assigneeId: identifier,
	priority,
});

export type TaskValues = z.infer<typeof taskValuesSchema>;
export type TaskPatch = Partial<TaskValues> & { id: string };
export type TaskMember = z.infer<typeof person>;

export function taskAccess(task: TaskView, actorId: string, role: string) {
	const elevated = role === "owner" || role === "admin";
	const member = elevated || role === "member";
	return {
		canEdit:
			member &&
			(elevated ||
				task.createdBy.id === actorId ||
				task.assignee?.id === actorId),
		canAssign: elevated,
	};
}

export function taskDraft(
	task: TaskView | null,
	actingUserId: string,
): TaskDraft {
	return {
		subject: task?.subject ?? "",
		body: task?.body ?? "",
		dueUtc: task?.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : "",
		assigneeId: task ? (task.assignee?.id ?? "") : actingUserId,
		priority: task?.priority ?? 0,
	};
}

export function taskValues(draft: TaskDraft): TaskValues {
	const values = taskDraftSchema.parse(draft);
	return taskValuesSchema.parse({
		subject: values.subject,
		body: values.body || null,
		dueAt: values.dueUtc ? `${values.dueUtc}:00.000Z` : null,
		assigneeId: values.assigneeId,
		priority: values.priority,
	});
}

export function taskPatch(task: TaskView, draft: TaskDraft): TaskPatch {
	const parsed = taskDraftSchema.parse(draft);
	const values = {
		...parsed,
		body: parsed.body || null,
		dueAt: parsed.dueUtc ? `${parsed.dueUtc}:00.000Z` : null,
	};
	const original = taskDraft(task, "");
	const changedAssignee = parsed.assigneeId !== (task.assignee?.id ?? "");
	if (changedAssignee) identifier.parse(parsed.assigneeId);
	return {
		id: task.id,
		...(values.subject !== task.subject ? { subject: values.subject } : {}),
		...(values.body !== task.body ? { body: values.body } : {}),
		...(draft.dueUtc !== original.dueUtc ? { dueAt: values.dueAt } : {}),
		...(changedAssignee ? { assigneeId: parsed.assigneeId } : {}),
		...(values.priority !== task.priority ? { priority: values.priority } : {}),
	};
}
