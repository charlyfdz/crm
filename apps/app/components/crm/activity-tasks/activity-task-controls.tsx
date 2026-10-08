"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { TimelineAnchor } from "../timeline/timeline";
import { ActivityTaskCreate } from "./activity-task-create";
import { ActivityTaskEditor } from "./activity-task-editor";
import { TASK_FORM } from "./task-form-config";
import { type TaskView, taskViewSchema } from "./task-form-state";

function useTaskContext(enabled = true) {
	const trpc = useTRPC();
	const [memberSearch, setMemberSearch] = useState("");
	const me = useQuery({ ...trpc.users.me.queryOptions(), enabled });
	const workspace = useQuery({ ...trpc.workspace.get.queryOptions(), enabled });
	const members = useQuery({
		...trpc.workspace.members.queryOptions({
			q: memberSearch,
			pageSize: TASK_FORM.memberPageSize,
			role: ["owner", "admin", "member"],
			activeOnly: true,
		}),
		enabled,
		placeholderData: (previous) => previous,
	});
	return {
		actorId: me.data?.id,
		role: workspace.data?.viewerRole,
		members: Array.from(
			new Map(
				[
					...(me.data && workspace.data?.viewerRole
						? [{ id: me.data.id, name: me.data.name }]
						: []),
					...(members.data?.rows.map((member) => ({
						id: member.userId,
						name: member.name,
					})) ?? []),
				].map((member) => [member.id, member]),
			).values(),
		),
		memberSearch,
		setMemberSearch,
		limited: (members.data?.total ?? 0) > (members.data?.rows.length ?? 0),
		failure:
			me.error?.message ??
			workspace.error?.message ??
			members.error?.message ??
			(workspace.isSuccess && !workspace.data.viewerRole
				? "La membresía vigente no permite gestionar tareas."
				: undefined),
		ready: me.isSuccess && workspace.isSuccess && members.isSuccess,
	};
}

function TaskContextNotice({
	failure,
	limited,
	search,
	onSearch,
	canAssign,
}: {
	failure?: string;
	limited: boolean;
	search: string;
	onSearch(value: string): void;
	canAssign: boolean;
}) {
	const id = useId();
	return (
		<div className="flex flex-col gap-4">
			{failure ? (
				<Alert variant="destructive">
					<AlertTitle>No se cargaron los permisos</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : limited ? (
				<Alert>
					<AlertTitle>Lista parcial de responsables</AlertTitle>
					<AlertDescription>
						El selector muestra hasta {TASK_FORM.memberPageSize} coincidencias.
						Busca por nombre o correo para localizar otros responsables.
					</AlertDescription>
				</Alert>
			) : null}
			{canAssign ? (
				<Field>
					<FieldLabel htmlFor={id}>
						Buscar responsables por nombre o correo
					</FieldLabel>
					<Input
						id={id}
						value={search}
						onChange={(event) => onSearch(event.target.value)}
						placeholder="Nombre o correo del miembro"
					/>
				</Field>
			) : null}
		</div>
	);
}

export function ActivityTaskCreateControl({
	anchor,
}: {
	anchor: TimelineAnchor;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const context = useTaskContext();
	const create = useMutation(trpc.activities.create.mutationOptions());
	return (
		<div className="flex flex-col gap-4">
			<TaskContextNotice
				failure={context.failure}
				limited={context.limited}
				search={context.memberSearch}
				onSearch={context.setMemberSearch}
				canAssign={context.role === "owner" || context.role === "admin"}
			/>
			{context.ready && context.actorId && context.role ? (
				<ActivityTaskCreate
					anchor={anchor}
					actorId={context.actorId}
					workspaceRole={context.role}
					members={context.members}
					onCreate={async (input) => {
						await create.mutateAsync({
							...input,
							body: input.body ?? undefined,
						});
						await cache.activity();
					}}
				/>
			) : !context.failure ? (
				<Spinner aria-label="Cargando permisos" />
			) : null}
		</div>
	);
}

export function ActivityTaskEditControl({ task }: { task: TaskView }) {
	const [open, setOpen] = useState(false);
	const context = useTaskContext(open);
	const trpc = useTRPC();
	const cache = useCrmCache();
	const update = useMutation(trpc.activities.updateTask.mutationOptions());
	const complete = useMutation(trpc.activities.complete.mutationOptions());
	const parsed = taskViewSchema.safeParse(task);
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					Gestionar tarea
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Seguimiento de tarea</DialogTitle>
					<DialogDescription>
						Edita detalles, responsable, prioridad y vencimiento. El autor
						original no cambia.
					</DialogDescription>
				</DialogHeader>
				<TaskContextNotice
					failure={context.failure}
					limited={context.limited}
					search={context.memberSearch}
					onSearch={context.setMemberSearch}
					canAssign={context.role === "owner" || context.role === "admin"}
				/>
				{!parsed.success ? (
					<Alert variant="destructive">
						<AlertTitle>Tarea no válida</AlertTitle>
						<AlertDescription>
							No se interpreta el registro. Recarga la ficha.
						</AlertDescription>
					</Alert>
				) : context.ready && context.actorId && context.role ? (
					<ActivityTaskEditor
						task={parsed.data}
						actorId={context.actorId}
						workspaceRole={context.role}
						members={context.members}
						onUpdate={async (patch) => {
							await update.mutateAsync(patch);
							await cache.activity();
						}}
						onComplete={async (input) => {
							await complete.mutateAsync(input);
							await cache.activity();
						}}
					/>
				) : !context.failure ? (
					<Spinner aria-label="Cargando permisos" />
				) : null}
			</DialogContent>
		</Dialog>
	);
}
