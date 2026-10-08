"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldTitle,
} from "@crm/ui/components/field";
import { Spinner } from "@crm/ui/components/spinner";
import { useState } from "react";
import { ActivityTaskForm } from "./activity-task-form";
import {
	type TaskMember,
	type TaskPatch,
	type TaskView,
	taskAccess,
	taskDraft,
	taskPatch,
} from "./task-form-state";

export function ActivityTaskEditor({
	task,
	actorId,
	workspaceRole,
	members,
	onUpdate,
	onComplete,
}: {
	task: TaskView;
	actorId: string;
	workspaceRole: string;
	members: TaskMember[];
	onUpdate(patch: TaskPatch): Promise<void>;
	onComplete(input: { id: string; completed: boolean }): Promise<void>;
}) {
	const access = taskAccess(task, actorId, workspaceRole);
	const [pending, setPending] = useState(false);
	const [saving, setSaving] = useState(false);
	const busy = pending || saving;
	const [failure, setFailure] = useState<string | null>(null);
	async function complete() {
		if (busy || !access.canEdit) return;
		setPending(true);
		setFailure(null);
		try {
			await onComplete({ id: task.id, completed: task.completedAt === null });
		} catch (error) {
			setFailure(
				error instanceof Error
					? error.message
					: "No se cambió el estado de la tarea.",
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<FieldGroup>
			<Field>
				<FieldTitle>Autor: {task.createdBy.name}</FieldTitle>
				<FieldDescription>
					Responsable: {task.assignee?.name ?? "Sin responsable"}. El autor no
					cambia al reasignar.
				</FieldDescription>
			</Field>
			{!access.canEdit ? (
				<Alert>
					<AlertTitle>Tarea de sólo lectura</AlertTitle>
					<AlertDescription>
						El autor, el responsable y admin/owner editan esta tarea. La API
						comprueba la membresía vigente.
					</AlertDescription>
				</Alert>
			) : null}
			{access.canEdit ? (
				<ActivityTaskForm
					key={`${task.id}:${task.subject}:${task.body}:${task.dueAt}:${task.assignee?.id}:${task.priority}`}
					initial={taskDraft(task, actorId)}
					members={members}
					canAssign={access.canAssign}
					preserveAssignee
					disabled={busy}
					submitLabel="Guardar tarea"
					onSubmit={async (draft) => {
						const patch = taskPatch(task, draft);
						setSaving(true);
						try {
							if (Object.keys(patch).length > 1) await onUpdate(patch);
						} finally {
							setSaving(false);
						}
					}}
				/>
			) : null}
			{failure ? (
				<Alert variant="destructive">
					<AlertTitle>No se cambió el estado</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			{access.canEdit ? (
				<Button
					type="button"
					variant="outline"
					disabled={busy}
					onClick={() => void complete()}
				>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{task.completedAt ? "Reabrir tarea" : "Completar tarea"}
				</Button>
			) : null}
		</FieldGroup>
	);
}
