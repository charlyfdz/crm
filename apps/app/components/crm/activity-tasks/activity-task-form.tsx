"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldTitle,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useId, useState } from "react";
import { TASK_FORM } from "./task-form-config";
import {
	TASK_PRIORITIES,
	type TaskDraft,
	type TaskMember,
	taskDraftSchema,
} from "./task-form-state";

export function ActivityTaskForm({
	initial,
	members,
	canAssign,
	preserveAssignee = false,
	disabled = false,
	submitLabel,
	onSubmit,
}: {
	initial: TaskDraft;
	members: TaskMember[];
	canAssign: boolean;
	preserveAssignee?: boolean;
	disabled?: boolean;
	submitLabel: string;
	onSubmit(draft: TaskDraft): Promise<void>;
}) {
	const id = useId();
	const [draft, setDraft] = useState(initial);
	const [selectedMember, setSelectedMember] = useState(() =>
		members.find((member) => member.id === initial.assigneeId),
	);
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const [validation, setValidation] = useState<
		Partial<Record<keyof TaskDraft, string>>
	>({});
	const busy = disabled || pending;
	const assignee =
		members.find((member) => member.id === draft.assigneeId) ??
		(selectedMember?.id === draft.assigneeId ? selectedMember : undefined);
	const options =
		assignee && !members.some((member) => member.id === assignee.id)
			? [assignee, ...members]
			: members;

	async function submit() {
		if (busy) return;
		const result = taskDraftSchema.safeParse(draft);
		if (!result.success) {
			setValidation(
				Object.fromEntries(
					result.error.issues.map((issue) => [issue.path[0], issue.message]),
				),
			);
			return;
		}
		if (
			!assignee &&
			!(preserveAssignee && draft.assigneeId === initial.assigneeId)
		) {
			setValidation({
				assigneeId:
					"Selecciona un miembro vigente. Conserva el autor original.",
			});
			return;
		}
		setValidation({});
		setFailure(null);
		setPending(true);
		try {
			await onSubmit(result.data);
		} catch (error) {
			setFailure(
				error instanceof Error
					? error.message
					: "No se guardó la tarea. Revisa la conexión y los permisos.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<form
			aria-label={submitLabel}
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<FieldGroup>
				{failure ? (
					<Alert variant="destructive">
						<AlertTitle>No se guardaron los cambios</AlertTitle>
						<AlertDescription>{failure}</AlertDescription>
					</Alert>
				) : null}
				<Field data-disabled={busy} data-invalid={Boolean(validation.subject)}>
					<FieldLabel htmlFor={`${id}-subject`}>Tarea</FieldLabel>
					<Input
						id={`${id}-subject`}
						name="subject"
						value={draft.subject}
						maxLength={TASK_FORM.subjectLength}
						required
						disabled={busy}
						aria-invalid={Boolean(validation.subject)}
						aria-describedby={
							validation.subject ? `${id}-subject-error` : undefined
						}
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								subject: event.target.value,
							}))
						}
					/>
					<FieldError id={`${id}-subject-error`}>
						{validation.subject}
					</FieldError>
				</Field>
				<Field data-disabled={busy} data-invalid={Boolean(validation.body)}>
					<FieldLabel htmlFor={`${id}-body`}>Detalles</FieldLabel>
					<Textarea
						id={`${id}-body`}
						name="body"
						value={draft.body}
						maxLength={TASK_FORM.bodyLength}
						disabled={busy}
						aria-invalid={Boolean(validation.body)}
						aria-describedby={validation.body ? `${id}-body-error` : undefined}
						onChange={(event) =>
							setDraft((current) => ({ ...current, body: event.target.value }))
						}
					/>
					<FieldError id={`${id}-body-error`}>{validation.body}</FieldError>
				</Field>
				<Field data-disabled={busy} data-invalid={Boolean(validation.dueUtc)}>
					<FieldLabel htmlFor={`${id}-due`}>Fecha y hora UTC</FieldLabel>
					<Input
						id={`${id}-due`}
						name="dueUtc"
						type="datetime-local"
						step={60}
						value={draft.dueUtc}
						disabled={busy}
						aria-invalid={Boolean(validation.dueUtc)}
						aria-describedby={`${id}-due-description ${id}-due-error`}
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								dueUtc: event.target.value,
							}))
						}
					/>
					<FieldDescription id={`${id}-due-description`}>
						UTC no es la hora local. Deja el campo vacío para quitar el
						vencimiento.
					</FieldDescription>
					<FieldError id={`${id}-due-error`}>{validation.dueUtc}</FieldError>
				</Field>
				<Field data-disabled={busy} data-invalid={Boolean(validation.priority)}>
					<FieldTitle id={`${id}-priority-label`}>Prioridad</FieldTitle>
					<ToggleGroup
						type="single"
						value={String(draft.priority)}
						disabled={busy}
						aria-labelledby={`${id}-priority-label`}
						aria-invalid={Boolean(validation.priority)}
						onValueChange={(value) => {
							if (value)
								setDraft((current) => ({
									...current,
									priority: Number(value),
								}));
						}}
					>
						{TASK_PRIORITIES.map((option) => (
							<ToggleGroupItem key={option.value} value={String(option.value)}>
								{option.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
					<FieldError>{validation.priority}</FieldError>
				</Field>
				<Field
					data-disabled={busy || !canAssign}
					data-invalid={Boolean(validation.assigneeId)}
				>
					<FieldLabel htmlFor={`${id}-assignee`}>Responsable</FieldLabel>
					{canAssign ? (
						<Select
							value={draft.assigneeId}
							disabled={busy}
							onValueChange={(assigneeId) => {
								setSelectedMember(
									members.find((member) => member.id === assigneeId),
								);
								setDraft((current) => ({ ...current, assigneeId }));
							}}
						>
							<SelectTrigger
								id={`${id}-assignee`}
								aria-invalid={Boolean(validation.assigneeId)}
								aria-describedby={`${id}-assignee-description`}
							>
								<SelectValue placeholder="Selecciona un miembro" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{options.map((member) => (
										<SelectItem key={member.id} value={member.id}>
											{member.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					) : (
						<Input
							id={`${id}-assignee`}
							value={assignee?.name ?? "Responsable sin membresía vigente"}
							disabled
							readOnly
						/>
					)}
					<FieldDescription id={`${id}-assignee-description`}>
						Sólo admin/owner asigna tareas a otra persona. La reasignación
						conserva el autor.
					</FieldDescription>
					<FieldError>{validation.assigneeId}</FieldError>
				</Field>
				<Button type="submit" disabled={busy}>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{pending ? "Guardando…" : submitLabel}
				</Button>
			</FieldGroup>
		</form>
	);
}
