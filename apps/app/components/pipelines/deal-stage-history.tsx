"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Spinner } from "@crm/ui/components/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { LocalDateTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import { PIPELINE_EDITOR } from "./pipeline-config";

export function DealStageHistory({ dealId }: { dealId: string }) {
	const trpc = useTRPC();
	const history = useQuery(
		trpc.deals.stageHistory.queryOptions({ id: dealId }),
	);
	const users = useQuery(trpc.users.list.queryOptions());
	if (history.isPending)
		return <Spinner aria-label="Cargando historial de etapas" />;
	if (history.isError)
		return (
			<Alert variant="destructive">
				<AlertTitle>No se carga el historial</AlertTitle>
				<AlertDescription>{history.error.message}</AlertDescription>
			</Alert>
		);
	if (!history.data.length)
		return (
			<Alert>
				<AlertTitle>No hay cambios registrados</AlertTitle>
				<AlertDescription>
					Los registros migrados conservan su etapa. La migración no inventa un
					historial anterior.
				</AlertDescription>
			</Alert>
		);
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Fecha</TableHead>
					<TableHead>Cambio</TableHead>
					<TableHead>Autor</TableHead>
					<TableHead>Motivo</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{history.data.map((entry) => (
					<TableRow key={entry.id}>
						<TableCell>
							<LocalDateTime
								date={entry.occurredAt}
								options={PIPELINE_EDITOR.dateOptions}
							/>
						</TableCell>
						<TableCell>
							{entry.fromStageName
								? `${entry.fromPipelineName} · ${entry.fromStageName}`
								: "Creación"}{" "}
							→ {entry.toPipelineName} · {entry.toStageName}
						</TableCell>
						<TableCell>
							{users.data?.find((user) => user.id === entry.actorId)?.name ??
								entry.actorId}
						</TableCell>
						<TableCell>{entry.reason ?? "—"}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
