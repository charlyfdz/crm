"use client";

import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import { Button } from "@crm/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { type MemberAction, MemberManagementDialog } from "./member-management";
import {
	memberActions,
	MEMBER_ROLE_LABEL as ROLE_LABEL,
} from "./member-policy";
import { membersSearchParams } from "./members-search-params";

type Role = keyof typeof ROLE_LABEL;

type MemberRow = RouterOutputs["workspace"]["members"]["rows"][number];

function columns(
	actorRole: string | null | undefined,
	onAction: (action: MemberAction) => void,
): DataTableColumn<MemberRow>[] {
	return [
		{
			id: "name",
			header: "Nombre",
			sortable: true,
			hideable: false,
			width: "w-[34%]",
			cell: (row) => (
				<span className="flex min-w-0 items-center gap-2">
					<PersonAvatar
						size="sm"
						src={row.image}
						name={row.name}
						email={row.email}
					/>
					<span className="truncate font-medium">{row.name}</span>
					{row.isViewer ? (
						<span className="text-muted-foreground text-xs">Tú</span>
					) : null}
				</span>
			),
		},
		{
			id: "email",
			header: "Correo",
			sortable: true,
			width: "w-[32%]",
			hideBelow: "md",
			cell: (row) => (
				<span className="truncate text-muted-foreground">{row.email}</span>
			),
		},
		{
			id: "role",
			header: "Rol",
			sortable: true,
			width: "w-[14%]",
			cell: (row) => (
				<span className="text-muted-foreground">{ROLE_LABEL[row.role]}</span>
			),
		},
		{
			id: "status",
			header: "Acceso",
			cell: (row) => (row.suspendedAt ? "Suspendido" : "Activo"),
		},
		{
			id: "joinedAt",
			header: "Alta",
			label: "Fecha de alta",
			sortable: true,
			align: "right",
			width: "w-[14%]",
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-muted-foreground">
					<LocalRelativeTime date={row.joinedAt} />
				</span>
			),
		},
		{
			id: "actions",
			header: <span className="sr-only">Acciones</span>,
			label: "Acciones",
			hideable: false,
			align: "right",
			width: "w-[6%]",
			cell: (row) =>
				memberActions(actorRole, row).canManage ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<Icon icon={OverflowMenuHorizontal} />
								<span className="sr-only">
									Administrar acceso de {row.name}
								</span>
							</Button>
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							{memberActions(actorRole, row).roleOptions.map((role) => (
								<DropdownMenuItem
									key={role}
									data-checked={row.role === role}
									onSelect={() => {
										if (row.role === role) return;
										onAction({ kind: "role", member: row, role });
									}}
								>
									{ROLE_LABEL[role]}
								</DropdownMenuItem>
							))}
							<DropdownMenuItem
								onSelect={() => onAction({ kind: "status", member: row })}
							>
								{row.suspendedAt ? "Reactivar cuenta" : "Suspender cuenta"}
							</DropdownMenuItem>
							{memberActions(actorRole, row).canResetPassword ? (
								<DropdownMenuItem
									onSelect={() => onAction({ kind: "password", member: row })}
								>
									Recuperar contraseña local
								</DropdownMenuItem>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null,
		},
	];
}

export function MembersTable() {
	const trpc = useTRPC();
	const [action, setAction] = useState<MemberAction | null>(null);
	const { query, input } = useTableQuery(membersSearchParams);

	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const members = useQuery({
		...trpc.workspace.members.queryOptions(input),
		placeholderData: (previous) => previous,
	});

	const facetCounts = members.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "role",
			label: "Rol",
			options: (Object.keys(ROLE_LABEL) as Role[]).flatMap((role) =>
				(facetCounts?.role?.[role] ?? 0) > 0
					? [{ value: role, label: ROLE_LABEL[role] }]
					: [],
			),
		},
	];

	return (
		<>
			<DataTable
				query={query}
				search={<ListSearch placeholder="Buscar nombre o correo…" />}
				columns={columns(workspace.data?.viewerRole, setAction)}
				rows={members.data?.rows ?? []}
				total={members.data?.total ?? 0}
				facetCounts={facetCounts}
				facets={facets}
				getRowId={(row) => row.id}
				loading={members.isFetching}
				empty="No hay personas que coincidan."
			/>
			{action ? (
				<MemberManagementDialog
					action={action}
					onClose={() => setAction(null)}
				/>
			) : null}
		</>
	);
}
