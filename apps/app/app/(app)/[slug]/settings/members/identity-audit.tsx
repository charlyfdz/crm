"use client";

import { Button } from "@crm/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import { IDENTITY_AUDIT_UI } from "./member-policy";

const ACTION_LABEL: Record<string, string> = {
	PROVISION_USER: "Cuenta creada",
	CHANGE_ROLE: "Rol cambiado",
	SUSPEND_USER: "Cuenta suspendida",
	REACTIVATE_USER: "Cuenta reactivada",
	RESET_PASSWORD: "Contraseña recuperada",
};

export function IdentityAudit() {
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const [page, setPage] = useState(1);
	const permitted =
		workspace.data?.viewerRole === "owner" ||
		workspace.data?.viewerRole === "admin";
	const audit = useQuery({
		...trpc.workspace.identityAudit.queryOptions({
			page,
			pageSize: IDENTITY_AUDIT_UI.pageSize,
		}),
		enabled: permitted,
	});
	if (!permitted) return null;
	return (
		<section aria-labelledby="identity-audit-heading">
			<h2 id="identity-audit-heading">Auditoría de acceso</h2>
			<p>
				Las altas operativas muestran actor de sistema. No hay contraseñas ni
				claves en este historial.
			</p>
			{audit.isError ? (
				<p role="alert">
					No se puede leer el historial.{" "}
					<Button variant="outline" onClick={() => audit.refetch()}>
						Reintentar
					</Button>
				</p>
			) : audit.isPending ? (
				<p role="status">Cargando historial…</p>
			) : (
				<>
					<ul>
						{audit.data.rows.map((row) => (
							<li key={row.id}>
								<LocalDateTime
									date={row.createdAt}
									options={IDENTITY_AUDIT_UI.dateOptions}
								/>{" "}
								{ACTION_LABEL[row.action] ?? row.action}. Usuario:{" "}
								{row.targetUserId}. Actor:{" "}
								{row.actorUserId ?? "Operador de instalación"}.
								{row.previousRole !== row.nextRole
									? ` Rol: ${row.previousRole ?? "sin rol"} → ${row.nextRole ?? "sin rol"}.`
									: null}
								{row.reason ? ` Motivo: ${row.reason}` : null}
							</li>
						))}
					</ul>
					{!audit.data.rows.length ? <p>Sin eventos en esta página.</p> : null}
					<div>
						<Button
							variant="outline"
							disabled={page === 1 || audit.isFetching}
							onClick={() => setPage((current) => current - 1)}
						>
							Anterior
						</Button>
						<span>Página {page}</span>
						<Button
							variant="outline"
							disabled={
								page * IDENTITY_AUDIT_UI.pageSize >= audit.data.total ||
								audit.isFetching
							}
							onClick={() => setPage((current) => current + 1)}
						>
							Siguiente
						</Button>
					</div>
				</>
			)}
		</section>
	);
}
