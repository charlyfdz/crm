"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
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
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { PIPELINE_EDITOR } from "./pipeline-config";
import {
	addDraftStage,
	configurationInput,
	OUTCOME_OPTIONS,
	type PipelineDraft,
	type PipelineOutcome,
	type PipelineView,
	pipelineDraft,
	pipelineDraftIssues,
	reorderStage,
} from "./pipeline-model";

export function PipelineSettings() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const id = useId();
	const query = useQuery(trpc.pipelines.list.queryOptions());
	const [choice, setChoice] = useState("new");
	const [version, setVersion] = useState(0);
	const [failure, setFailure] = useState<string | null>(null);
	const [confirmArchive, setConfirmArchive] = useState(false);
	const source = query.data?.rows.find((row) => row.id === choice) ?? null;
	const save = useMutation(trpc.pipelines.configure.mutationOptions());
	const archive = useMutation(trpc.pipelines.archive.mutationOptions());
	const busy = save.isPending || archive.isPending;
	if (query.isPending)
		return <Spinner aria-label="Cargando procesos comerciales" />;
	if (query.isError)
		return (
			<Alert variant="destructive">
				<AlertTitle>No se cargan los procesos</AlertTitle>
				<AlertDescription>
					{query.error.message}
					<Button variant="outline" onClick={() => void query.refetch()}>
						Reintentar
					</Button>
				</AlertDescription>
			</Alert>
		);
	const canManage = query.data.canManage;
	return (
		<FieldGroup>
			<Alert>
				<AlertTitle>Procesos independientes por instalación</AlertTitle>
				<AlertDescription>
					Los nombres y el orden son configurables. Cada etapa conserva su
					identificador y su resultado. El historial conserva los nombres
					originales.
				</AlertDescription>
			</Alert>
			<Field>
				<FieldLabel htmlFor={id}>Proceso comercial</FieldLabel>
				<Select
					value={choice}
					disabled={busy}
					onValueChange={(value) => {
						setChoice(value);
						setFailure(null);
						setConfirmArchive(false);
					}}
				>
					<SelectTrigger id={id}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="new">
								{canManage ? "Crear proceso" : "Selecciona un proceso"}
							</SelectItem>
							{query.data.rows.map((row) => (
								<SelectItem key={row.id} value={row.id}>
									{row.name}
									{row.isDefault ? " · Predeterminado" : ""}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</Field>
			{failure ? (
				<Alert variant="destructive">
					<AlertTitle>No se guarda el cambio</AlertTitle>
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			) : null}
			{choice !== "new" && !source ? (
				<Alert variant="destructive">
					<AlertTitle>El proceso ya no está disponible</AlertTitle>
					<AlertDescription>
						Selecciona un proceso activo. El formulario no crea un proceso en su
						lugar.
					</AlertDescription>
				</Alert>
			) : canManage ? (
				<>
					<PipelineForm
						key={`${choice}:${version}`}
						source={source}
						isFirst={query.data.rows.length === 0}
						disabled={busy}
						onSave={async (draft) => {
							setFailure(null);
							try {
								const saved = await save.mutateAsync(configurationInput(draft));
								await cache.pipelines();
								setChoice(saved.id);
								setVersion((current) => current + 1);
							} catch (error) {
								setFailure(
									error instanceof Error
										? error.message
										: "No se guarda el proceso.",
								);
							}
						}}
					/>
					<Button
						variant="outline"
						disabled={busy}
						onClick={() => {
							setVersion((current) => current + 1);
							setFailure(null);
						}}
					>
						Recargar formulario y descartar cambios
					</Button>
					{source && !source.isDefault ? (
						<Field>
							<FieldDescription>
								El archivo retira el proceso de los selectores. La API rechaza
								procesos con oportunidades activas o archivadas.
							</FieldDescription>
							{confirmArchive ? (
								<Button
									variant="destructive"
									disabled={busy}
									onClick={() =>
										void (async () => {
											setFailure(null);
											try {
												await archive.mutateAsync({ id: source.id });
												await cache.pipelines();
												setChoice("new");
												setConfirmArchive(false);
											} catch (error) {
												setFailure(
													error instanceof Error
														? error.message
														: "No se archiva el proceso.",
												);
											}
										})()
									}
								>
									Confirmar archivo de {source.name}
								</Button>
							) : (
								<Button
									variant="outline"
									disabled={busy}
									onClick={() => setConfirmArchive(true)}
								>
									Archivar este proceso
								</Button>
							)}
						</Field>
					) : null}
				</>
			) : (
				<>
					<Alert>
						<AlertTitle>Configuración de sólo lectura</AlertTitle>
						<AlertDescription>
							Sólo propietarios y administradores cambian los procesos
							comerciales.
						</AlertDescription>
					</Alert>
					{source ? (
						<ol>
							{source.stages.map((stage) => (
								<li key={stage.id}>
									{stage.position + 1}. {stage.name} ·{" "}
									{
										OUTCOME_OPTIONS.find(
											(option) => option.value === stage.outcome,
										)?.label
									}
								</li>
							))}
						</ol>
					) : null}
				</>
			)}
		</FieldGroup>
	);
}

function PipelineForm({
	source,
	isFirst,
	disabled,
	onSave,
}: {
	source: PipelineView | null;
	isFirst: boolean;
	disabled: boolean;
	onSave(draft: PipelineDraft): Promise<void>;
}) {
	const id = useId();
	const [draft, setDraft] = useState(() => pipelineDraft(source, isFirst));
	const [submitted, setSubmitted] = useState(false);
	const issues = pipelineDraftIssues(draft, source, true);
	const updateStage = (
		key: string,
		change: { name?: string; outcome?: PipelineOutcome },
	) =>
		setDraft((current) => ({
			...current,
			stages: current.stages.map((stage) =>
				stage.key === key ? { ...stage, ...change } : stage,
			),
		}));
	return (
		<form
			aria-label="Configurar proceso comercial"
			onSubmit={(event) => {
				event.preventDefault();
				setSubmitted(true);
				if (!disabled && issues.length === 0) void onSave(draft);
			}}
		>
			<FieldGroup>
				<Field
					data-disabled={disabled}
					data-invalid={submitted && issues.length > 0}
				>
					<FieldLabel htmlFor={`${id}-name`}>Nombre del proceso</FieldLabel>
					<Input
						id={`${id}-name`}
						required
						maxLength={PIPELINE_EDITOR.nameLength}
						value={draft.name}
						disabled={disabled}
						aria-invalid={submitted && issues.length > 0}
						onChange={(event) =>
							setDraft((current) => ({ ...current, name: event.target.value }))
						}
					/>
				</Field>
				<Field
					orientation="horizontal"
					data-disabled={disabled || Boolean(source?.isDefault)}
				>
					<Checkbox
						id={`${id}-default`}
						checked={draft.isDefault}
						disabled={disabled || Boolean(source?.isDefault)}
						onCheckedChange={(checked) =>
							setDraft((current) => ({
								...current,
								isDefault: checked === true,
							}))
						}
					/>
					<FieldLabel htmlFor={`${id}-default`}>
						Proceso predeterminado para nuevas oportunidades
					</FieldLabel>
				</Field>
				<FieldSet>
					<FieldLegend>Etapas</FieldLegend>
					<FieldDescription>
						Incluye una etapa abierta, una ganada y una perdida. Retira sólo
						etapas sin oportunidades. El resultado existente no cambia.
					</FieldDescription>
					<FieldGroup>
						{draft.stages.map((stage, index) => (
							<FieldSet key={stage.key} disabled={disabled}>
								<FieldLegend variant="label">Etapa {index + 1}</FieldLegend>
								<Field>
									<FieldLabel htmlFor={`${id}-${stage.key}`}>
										Nombre de etapa
									</FieldLabel>
									<Input
										id={`${id}-${stage.key}`}
										required
										maxLength={PIPELINE_EDITOR.nameLength}
										value={stage.name}
										disabled={disabled}
										onChange={(event) =>
											updateStage(stage.key, { name: event.target.value })
										}
									/>
								</Field>
								<Field>
									<FieldTitle id={`${id}-${stage.key}-outcome`}>
										Resultado
									</FieldTitle>
									<ToggleGroup
										type="single"
										value={stage.outcome}
										disabled={disabled || Boolean(stage.id)}
										aria-labelledby={`${id}-${stage.key}-outcome`}
										onValueChange={(value) => {
											if (
												OUTCOME_OPTIONS.some((option) => option.value === value)
											)
												updateStage(stage.key, {
													outcome: value as PipelineOutcome,
												});
										}}
									>
										{OUTCOME_OPTIONS.map((option) => (
											<ToggleGroupItem key={option.value} value={option.value}>
												{option.label}
											</ToggleGroupItem>
										))}
									</ToggleGroup>
								</Field>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										disabled={disabled || index === 0}
										aria-label={`Subir etapa ${index + 1}`}
										onClick={() =>
											setDraft((current) =>
												reorderStage(current, stage.key, -1),
											)
										}
									>
										Subir
									</Button>
									<Button
										type="button"
										variant="outline"
										disabled={disabled || index === draft.stages.length - 1}
										aria-label={`Bajar etapa ${index + 1}`}
										onClick={() =>
											setDraft((current) => reorderStage(current, stage.key, 1))
										}
									>
										Bajar
									</Button>
									<Button
										type="button"
										variant="outline"
										disabled={
											disabled ||
											draft.stages.length <= PIPELINE_EDITOR.stageMinimum
										}
										aria-label={`Retirar etapa ${index + 1}`}
										onClick={() =>
											setDraft((current) => ({
												...current,
												stages: current.stages.filter(
													(entry) => entry.key !== stage.key,
												),
											}))
										}
									>
										Retirar
									</Button>
								</div>
							</FieldSet>
						))}
					</FieldGroup>
				</FieldSet>
				<Button
					type="button"
					variant="outline"
					disabled={
						disabled || draft.stages.length >= PIPELINE_EDITOR.stageLimit
					}
					onClick={() => setDraft(addDraftStage)}
				>
					Añadir etapa
				</Button>
				{submitted && issues.length ? (
					<Alert variant="destructive">
						<AlertTitle>Revisa la configuración</AlertTitle>
						<AlertDescription>
							<ul>
								{issues.map((issue) => (
									<li key={issue}>{issue}</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				) : null}
				<Button type="submit" disabled={disabled}>
					{disabled ? <Spinner data-icon="inline-start" /> : null}Guardar
					proceso
				</Button>
			</FieldGroup>
		</form>
	);
}
