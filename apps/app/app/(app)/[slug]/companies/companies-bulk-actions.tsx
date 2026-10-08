"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Renew from "@carbon/icons-react/es/Renew";
import Undo from "@carbon/icons-react/es/Undo";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@crm/ui/components/dropdown-menu";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	BulkOwnerMenu,
	reportBulk,
} from "@/components/crm/bulk-actions";
import {
	type BulkRecord,
	useRecordSelection,
} from "@/components/crm/use-record-selection";
import { useRecordOwners } from "@/components/crm/use-record-viewer";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function companies(count: number): string {
	return formatCount(count, "company", "companies");
}

export function CompaniesBulkActions({
	ids,
	onDone,
	archived,
	rows,
}: {
	ids: string[];
	onDone: () => void;
	archived: boolean;
	rows: BulkRecord[];
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const access = useRecordSelection(ids, rows);
	const users = useRecordOwners(access.canAssign && !archived);
	const [confirming, setConfirming] = useState(false);

	const onError = (error: { message: string }) => toast.error(error.message);

	const assignOwner = useMutation(
		trpc.companies.bulkAssignOwner.mutationOptions({
			onSuccess: async (result) => {
				await cache.company();
				reportBulk(result, (count) => `${companies(count)} reassigned.`);
				onDone();
			},
			onError,
		}),
	);

	const enrich = useMutation(
		trpc.companies.bulkEnrich.mutationOptions({
			onSuccess: async (result) => {
				await cache.company();
				reportBulk(
					result,
					(count) => `Looking up ${companies(count)} — the table will update.`,
				);
				onDone();
			},
			onError,
		}),
	);

	const archive = useMutation(
		trpc.companies.bulkArchive.mutationOptions({
			onSuccess: async (result) => {
				await cache.company();
				reportBulk(result, (count) => `${companies(count)} archived.`);
				onDone();
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.companies.bulkRestore.mutationOptions({
			onSuccess: async (result) => {
				await cache.company();
				reportBulk(result, (count) => `${companies(count)} restored.`);
				onDone();
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.companies.bulkPurge.mutationOptions({
			onSuccess: async (result) => {
				await cache.company();
				reportBulk(result, (count) => `${companies(count)} deleted forever.`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	if (archived) {
		const pending = restore.isPending || purge.isPending;

		return (
			<>
				<BulkActionsMenu pending={pending || access.loading || access.error}>
					<DropdownMenuLabel>
						{access.restoreIds.length} de {ids.length} restaurables
					</DropdownMenuLabel>
					<DropdownMenuGroup>
						<DropdownMenuItem
							disabled={!access.restoreIds.length}
							onSelect={() => {
								if (access.restoreIds.length)
									restore.mutate({ ids: access.restoreIds });
							}}
						>
							<Undo />
							Restaurar
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem
							variant="destructive"
							disabled={!access.purgeIds.length}
							onSelect={() => setConfirming(true)}
						>
							Eliminar definitivamente ({access.purgeIds.length})
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</BulkActionsMenu>

				<BulkDeleteDialog
					open={confirming && access.purgeIds.length > 0}
					onOpenChange={setConfirming}
					title={`¿Eliminar ${access.purgeIds.length} registros definitivamente?`}
					description="This cannot be undone."
					pending={pending}
					disabled={!access.purgeIds.length}
					onConfirm={() => {
						if (access.purgeIds.length) purge.mutate({ ids: access.purgeIds });
					}}
				/>
			</>
		);
	}

	const pending =
		assignOwner.isPending || enrich.isPending || archive.isPending;

	return (
		<BulkActionsMenu pending={pending || access.loading || access.error}>
			<DropdownMenuLabel>
				{access.editIds.length} de {ids.length} editables
			</DropdownMenuLabel>
			{access.canAssign && users.ready && access.editIds.length > 0 ? (
				<BulkOwnerMenu
					users={users.users}
					unassignedLabel="Sin responsable"
					onSelect={(ownerId) =>
						assignOwner.mutate({ ids: access.editIds, ownerId })
					}
				/>
			) : null}
			<DropdownMenuGroup>
				<DropdownMenuItem
					disabled={!access.enrichIds.length}
					onSelect={() => {
						if (access.enrichIds.length)
							enrich.mutate({ ids: access.enrichIds });
					}}
				>
					<Renew />
					Investigar con IA ({access.enrichIds.length})
				</DropdownMenuItem>
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuGroup>
				<DropdownMenuItem
					disabled={!access.archiveIds.length}
					onSelect={() => {
						if (access.archiveIds.length)
							archive.mutate({ ids: access.archiveIds });
					}}
				>
					<Archive />
					Archivar ({access.archiveIds.length})
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</BulkActionsMenu>
	);
}
