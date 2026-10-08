"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	creatableRoles,
	MEMBER_ROLE_LABEL,
	type MemberRole,
} from "./member-policy";

type Member = RouterOutputs["workspace"]["members"]["rows"][number];
export type MemberAction =
	| { kind: "create" }
	| { kind: "status"; member: Member }
	| { kind: "password"; member: Member }
	| { kind: "role"; member: Member; role: MemberRole };
type Draft = {
	name: string;
	email: string;
	password: string;
	role: "admin" | "member";
	reason: string;
};
const emptyDraft = (): Draft => ({
	name: "",
	email: "",
	password: "",
	role: "member",
	reason: "",
});

export function MemberFields({
	action,
	draft,
	onChange,
	roles,
	passwordPolicy,
	disabled,
}: {
	action: MemberAction;
	draft: Draft;
	onChange: (draft: Draft) => void;
	roles: readonly ("admin" | "member")[];
	passwordPolicy: { minLength: number; maxLength: number };
	disabled: boolean;
}) {
	const id = useId();
	return (
		<FieldGroup>
			{action.kind === "create" ? (
				<>
					<Field>
						<FieldLabel htmlFor={`${id}-name`}>Nombre</FieldLabel>
						<Input
							id={`${id}-name`}
							value={draft.name}
							onChange={(event) =>
								onChange({ ...draft, name: event.target.value })
							}
							maxLength={120}
							autoComplete="off"
							required
							disabled={disabled}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-email`}>Correo autorizado</FieldLabel>
						<Input
							id={`${id}-email`}
							type="email"
							value={draft.email}
							onChange={(event) =>
								onChange({ ...draft, email: event.target.value })
							}
							maxLength={254}
							autoComplete="off"
							required
							disabled={disabled}
						/>
						<FieldDescription>
							Debe estar permitido por la configuración de esta instalación. No
							se envía correo.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-role`}>Rol inicial</FieldLabel>
						<Select
							value={draft.role}
							onValueChange={(value) => {
								if (value === "admin" || value === "member")
									onChange({ ...draft, role: value });
							}}
							disabled={disabled}
						>
							<SelectTrigger id={`${id}-role`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{roles.map((role) => (
									<SelectItem key={role} value={role}>
										{MEMBER_ROLE_LABEL[role]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</>
			) : null}
			{action.kind === "create" || action.kind === "password" ? (
				<Field>
					<FieldLabel htmlFor={`${id}-password`}>
						Nueva contraseña local
					</FieldLabel>
					<Input
						id={`${id}-password`}
						type="password"
						value={draft.password}
						onChange={(event) =>
							onChange({ ...draft, password: event.target.value })
						}
						minLength={passwordPolicy.minLength}
						maxLength={passwordPolicy.maxLength}
						autoComplete="new-password"
						required
						disabled={disabled}
					/>
					<FieldDescription>
						Mínimo {passwordPolicy.minLength} caracteres. Entrégala por un medio
						seguro. El CRM no la muestra ni la envía después.
					</FieldDescription>
				</Field>
			) : null}
			{action.kind === "password" || action.kind === "status" ? (
				<Field>
					<FieldLabel htmlFor={`${id}-reason`}>Motivo</FieldLabel>
					<Input
						id={`${id}-reason`}
						value={draft.reason}
						onChange={(event) =>
							onChange({ ...draft, reason: event.target.value })
						}
						maxLength={500}
						autoComplete="off"
						required
						disabled={disabled}
					/>
					<FieldDescription>
						Se registra en la auditoría. No incluyas contraseñas ni datos
						sensibles.
					</FieldDescription>
				</Field>
			) : null}
			{action.kind === "role" ? (
				<p>
					Confirmas el cambio de {action.member.name} a{" "}
					{MEMBER_ROLE_LABEL[action.role]}. Todas sus sesiones y claves se
					revocarán.
				</p>
			) : null}
		</FieldGroup>
	);
}

export function MemberManagementDialog({
	action,
	onClose,
}: {
	action: MemberAction;
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const formId = useId();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const [draft, setDraft] = useState(emptyDraft);
	const [error, setError] = useState<string | null>(null);
	const close = () => {
		setDraft(emptyDraft());
		onClose();
	};
	const onSuccess = async () => {
		setDraft(emptyDraft());
		onClose();
		if (
			(action.kind === "role" || action.kind === "status") &&
			action.member.isViewer
		) {
			window.location.assign("/sign-in");
			return;
		}
		try {
			await cache.workspace();
			toast.success("Cambio de acceso guardado.");
		} catch {
			toast.warning(
				"Cambio guardado. Recarga la página para actualizar las vistas.",
			);
		}
	};
	const onError = (failure: { message: string }) => {
		setDraft((current) => ({ ...current, password: "" }));
		setError(failure.message);
	};
	const create = useMutation(
		trpc.workspace.createMember.mutationOptions({ onSuccess, onError }),
	);
	const status = useMutation(
		trpc.workspace.setMemberStatus.mutationOptions({ onSuccess, onError }),
	);
	const password = useMutation(
		trpc.workspace.resetMemberPassword.mutationOptions({ onSuccess, onError }),
	);
	const role = useMutation(
		trpc.workspace.setMemberRole.mutationOptions({ onSuccess, onError }),
	);
	const pending =
		create.isPending ||
		status.isPending ||
		password.isPending ||
		role.isPending;
	const title =
		action.kind === "create"
			? "Crear cuenta local"
			: action.kind === "password"
				? "Recuperar contraseña"
				: action.kind === "role"
					? "Cambiar rol"
					: action.member.suspendedAt
						? "Reactivar cuenta"
						: "Suspender cuenta";
	const policy = workspace.data?.passwordPolicy;
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) close();
			}}
		>
			<DialogContent showCloseButton={!pending}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						{action.kind === "create"
							? "Cuenta privada para esta empresa, sin registro público."
							: `${action.member.name}. No se eliminan sus registros comerciales. Suspender o recuperar contraseña revoca el acceso existente.`}
					</DialogDescription>
				</DialogHeader>
				<form
					id={formId}
					onSubmit={(event) => {
						event.preventDefault();
						setError(null);
						if (!policy) return;
						if (action.kind === "create")
							create.mutate({
								name: draft.name.trim(),
								email: draft.email.trim(),
								password: draft.password,
								role: draft.role,
							});
						else if (action.kind === "status")
							status.mutate({
								memberId: action.member.id,
								suspended: !action.member.suspendedAt,
								reason: draft.reason.trim(),
							});
						else if (action.kind === "password")
							password.mutate({
								memberId: action.member.id,
								password: draft.password,
								reason: draft.reason.trim(),
							});
						else role.mutate({ memberId: action.member.id, role: action.role });
					}}
				>
					{policy ? (
						<MemberFields
							action={action}
							draft={draft}
							onChange={setDraft}
							roles={creatableRoles(workspace.data?.viewerRole)}
							passwordPolicy={policy}
							disabled={pending}
						/>
					) : (
						<p role="status">
							{workspace.isError
								? "No se puede leer la política de acceso. Recarga la página."
								: "Leyendo política de acceso…"}
						</p>
					)}
					{error ? <p role="alert">{error}</p> : null}
				</form>
				<DialogFooter>
					<Button variant="outline" disabled={pending} onClick={close}>
						Cancelar
					</Button>
					<Button type="submit" form={formId} disabled={pending || !policy}>
						{pending ? <Spinner /> : null}Confirmar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function CreateMemberButton() {
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				onClick={() => setOpen(true)}
				disabled={!creatableRoles(workspace.data?.viewerRole).length}
			>
				Crear cuenta local
			</Button>
			{open ? (
				<MemberManagementDialog
					action={{ kind: "create" }}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	);
}
