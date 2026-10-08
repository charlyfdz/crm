"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { useState } from "react";
import { ActivityTaskForm } from "./activity-task-form";
import {
	type TaskMember,
	type TaskValues,
	taskDraft,
	taskValues,
} from "./task-form-state";

type TaskAnchor = { companyId?: string; contactId?: string; dealId?: string };

export function ActivityTaskCreate({
	anchor,
	actorId,
	workspaceRole,
	members,
	onCreate,
}: {
	anchor: TaskAnchor;
	actorId: string;
	workspaceRole: string;
	members: TaskMember[];
	onCreate(input: TaskValues & TaskAnchor & { type: "TASK" }): Promise<void>;
}) {
	const [revision, setRevision] = useState(0);
	if (
		workspaceRole !== "owner" &&
		workspaceRole !== "admin" &&
		workspaceRole !== "member"
	)
		return (
			<Alert>
				<AlertTitle>Creación no disponible</AlertTitle>
				<AlertDescription>
					Necesitas una membresía vigente con permisos de escritura.
				</AlertDescription>
			</Alert>
		);
	if (!anchor.companyId && !anchor.contactId && !anchor.dealId)
		return (
			<Alert>
				<AlertTitle>Selecciona un registro</AlertTitle>
				<AlertDescription>
					La tarea necesita una empresa, contacto u oportunidad.
				</AlertDescription>
			</Alert>
		);
	return (
		<ActivityTaskForm
			key={`${actorId}:${revision}`}
			initial={taskDraft(null, actorId)}
			members={members}
			canAssign={workspaceRole === "owner" || workspaceRole === "admin"}
			submitLabel="Crear tarea"
			onSubmit={async (draft) => {
				const values = taskValues(draft);
				await onCreate({ ...values, ...anchor, type: "TASK" });
				setRevision((current) => current + 1);
			}}
		/>
	);
}
