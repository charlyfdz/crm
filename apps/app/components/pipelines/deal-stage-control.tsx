"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { PIPELINE_EDITOR } from "./pipeline-config";
import {
	initialPipelineSelection,
	orderedStages,
	outcomeLabel,
	type PipelineView,
	stageChangeIssues,
} from "./pipeline-model";

type CurrentStage = {
	id: string;
	name: string;
	pipelineId: string;
	pipeline: { id: string; name: string };
};

export function DealStageControl({
	dealId,
	current,
	archived = false,
}: {
	dealId: string;
	current?: CurrentStage | null;
	archived?: boolean;
}) {
	const trpc = useTRPC();
	const [open, setOpen] = useState(false);
	const deal = useQuery({
		...trpc.deals.byId.queryOptions({ id: dealId }),
		enabled: open,
	});
	const stage = deal.data?.pipelineStage ?? current;
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					disabled={archived}
					onClick={(event) => event.stopPropagation()}
				>
					{stage?.name ?? "Ver etapa"}
				</Button>
			</DialogTrigger>
			<DialogContent onClick={(event) => event.stopPropagation()}>
				<DialogHeader>
					<DialogTitle>Etapa de la oportunidad</DialogTitle>
					<DialogDescription>
						{stage
							? `${stage.pipeline.name} · ${stage.name}`
							: "Consulta y cambia la etapa por su identificador estable."}
					</DialogDescription>
				</DialogHeader>
				{open && deal.data ? (
					<StageForm
						key={`${dealId}:${deal.data.pipelineStage?.id}`}
						dealId={dealId}
						current={deal.data.pipelineStage}
						ownerId={deal.data.owner.id}
						archived={Boolean(deal.data.archivedAt)}
						onDone={() => setOpen(false)}
					/>
				) : deal.isError ? (
					<Alert variant="destructive">
						<AlertTitle>No se carga la oportunidad</AlertTitle>
						<AlertDescription>{deal.error.message}</AlertDescription>
					</Alert>
				) : (
					<Spinner aria-label="Cargando oportunidad" />
				)}
			</DialogContent>
		</Dialog>
	);
}

function StageForm({
	dealId,
	current,
	ownerId,
	archived,
	onDone,
}: {
	dealId: string;
	current: CurrentStage | null;
	ownerId: string;
	archived: boolean;
	onDone(): void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const id = useId();
	const query = useQuery(trpc.pipelines.list.queryOptions());
	const me = useQuery(trpc.users.me.queryOptions());
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const [pipelineId, setPipelineId] = useState(current?.pipelineId ?? "");
	const [stageId, setStageId] = useState(current?.id ?? "");
	const [reason, setReason] = useState("");
	const [confirmedMove, setConfirmedMove] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const mutation = useMutation(trpc.deals.setStage.mutationOptions());
	if (query.isPending || me.isPending || workspace.isPending)
		return <Spinner aria-label="Cargando etapas y permisos" />;
	if (query.isError || me.isError || workspace.isError)
		return (
			<Alert variant="destructive">
				<AlertTitle>No se cargan etapas o permisos</AlertTitle>
				<AlertDescription>
					Recarga la página. No se cambia la oportunidad.
				</AlertDescription>
			</Alert>
		);
	const rows: PipelineView[] = query.data.rows;
	const pipeline = rows.find((row) => row.id === pipelineId);
	const role = workspace.data.viewerRole;
	const canEdit =
		!archived &&
		(role === "owner" ||
			role === "admin" ||
			(role === "member" && me.data.id === ownerId));
	const issues = stageChangeIssues({
		rows,
		pipelineId,
		pipelineStageId: stageId,
		currentPipelineId: current?.pipelineId,
		currentStageId: current?.id,
		confirmedMove,
		reason,
	});
	return (
		<form
			aria-label="Cambiar etapa"
			onSubmit={(event) => {
				event.preventDefault();
				if (!canEdit || mutation.isPending || issues.length) return;
				void (async () => {
					setFailure(null);
					try {
						await mutation.mutateAsync({
							id: dealId,
							pipelineId,
							pipelineStageId: stageId,
							closedReason: reason.trim() || undefined,
						});
						await cache.deal(dealId);
						onDone();
					} catch (error) {
						setFailure(
							error instanceof Error ? error.message : "No se cambia la etapa.",
						);
					}
				})();
			}}
		>
			<FieldGroup>
				{!canEdit ? (
					<Alert>
						<AlertTitle>Oportunidad de sólo lectura</AlertTitle>
						<AlertDescription>
							El responsable y administración cambian la etapa. Restaura los
							registros archivados antes de cambiarlos.
						</AlertDescription>
					</Alert>
				) : null}
				<Field>
					<FieldLabel htmlFor={`${id}-pipeline`}>Proceso comercial</FieldLabel>
					<Select
						value={pipelineId}
						disabled={!canEdit || mutation.isPending}
						onValueChange={(value) => {
							setPipelineId(value);
							setStageId(
								initialPipelineSelection(rows, value)?.pipelineStageId ?? "",
							);
							setConfirmedMove(false);
						}}
					>
						<SelectTrigger id={`${id}-pipeline`}>
							<SelectValue placeholder="Selecciona un proceso" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{rows.map((row) => (
									<SelectItem key={row.id} value={row.id}>
										{row.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-stage`}>Etapa</FieldLabel>
					<Select
						value={stageId}
						disabled={!canEdit || mutation.isPending}
						onValueChange={setStageId}
					>
						<SelectTrigger id={`${id}-stage`}>
							<SelectValue placeholder="Selecciona una etapa" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{pipeline
									? orderedStages(pipeline).map((stage) => (
											<SelectItem key={stage.id} value={stage.id}>
												{stage.name} · {outcomeLabel(stage.outcome)}
											</SelectItem>
										))
									: null}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor={`${id}-reason`}>Motivo o nota</FieldLabel>
					<Textarea
						id={`${id}-reason`}
						value={reason}
						maxLength={PIPELINE_EDITOR.reasonLength}
						disabled={!canEdit || mutation.isPending}
						onChange={(event) => setReason(event.target.value)}
					/>
					<FieldDescription>
						El motivo es obligatorio al perder o descartar. Ganar crea una tarea
						de transferencia operativa para el responsable.
					</FieldDescription>
				</Field>
				{current?.pipelineId && pipelineId !== current.pipelineId ? (
					<Field orientation="horizontal">
						<Checkbox
							id={`${id}-confirm`}
							checked={confirmedMove}
							disabled={!canEdit || mutation.isPending}
							onCheckedChange={(checked) => setConfirmedMove(checked === true)}
						/>
						<FieldLabel htmlFor={`${id}-confirm`}>
							Confirmo el movimiento a otro proceso comercial.
						</FieldLabel>
					</Field>
				) : null}
				{failure ? (
					<Alert variant="destructive">
						<AlertTitle>No se cambia la etapa</AlertTitle>
						<AlertDescription>{failure}</AlertDescription>
					</Alert>
				) : null}
				{canEdit && issues.length ? (
					<Alert>
						<AlertTitle>Antes de guardar</AlertTitle>
						<AlertDescription>
							<ul>
								{issues.map((issue) => (
									<li key={issue}>{issue}</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				) : null}
				<Button
					type="submit"
					disabled={!canEdit || mutation.isPending || issues.length > 0}
				>
					{mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
					Guardar etapa
				</Button>
			</FieldGroup>
		</form>
	);
}
