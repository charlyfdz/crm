"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Renew from "@carbon/icons-react/es/Renew";
import Undo from "@carbon/icons-react/es/Undo";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@crm/ui/components/dropdown-menu";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	BulkOwnerMenu,
	reportBulk,
} from "@/components/crm/bulk-actions";
import { CompanyMenuSearch } from "@/components/crm/company-picker";
import {
	type BulkRecord,
	useRecordSelection,
} from "@/components/crm/use-record-selection";
import { useRecordOwners } from "@/components/crm/use-record-viewer";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function contacts(count: number): string {
	return formatCount(count, "contact");
}

export function ContactsBulkActions({
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
	const [menuOpen, setMenuOpen] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const companySearch = useRef<HTMLInputElement>(null);

	const onError = (error: { message: string }) => toast.error(error.message);

	const assignOwner = useMutation(
		trpc.contacts.bulkAssignOwner.mutationOptions({
			onSuccess: async (result) => {
				await cache.contact();
				reportBulk(result, (count) => `${contacts(count)} reassigned.`);
				onDone();
			},
			onError,
		}),
	);

	const setCompany = useMutation(
		trpc.contacts.bulkSetCompany.mutationOptions({
			onSuccess: async (result) => {
				await cache.contact();
				reportBulk(result, (count) => `${contacts(count)} moved.`);
				onDone();
			},
			onError,
		}),
	);

	const enrich = useMutation(
		trpc.contacts.bulkEnrich.mutationOptions({
			onSuccess: async (result) => {
				await cache.contact();
				reportBulk(
					result,
					(count) => `Looking up ${contacts(count)} — the table will update.`,
				);
				onDone();
			},
			onError,
		}),
	);

	const archive = useMutation(
		trpc.contacts.bulkArchive.mutationOptions({
			onSuccess: async (result) => {
				await cache.contact();
				reportBulk(result, (count) => `${contacts(count)} archived.`);
				onDone();
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.contacts.bulkRestore.mutationOptions({
			onSuccess: async (result) => {
				await cache.contact();
				reportBulk(result, (count) => `${contacts(count)} restored.`);
				onDone();
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.contacts.bulkPurge.mutationOptions({
			onSuccess: async (result) => {
				await cache.contact();
				reportBulk(result, (count) => `${contacts(count)} deleted forever.`);
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
					description="Their email addresses are suppressed, so the inbox sync will not file them again. This cannot be undone."
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
		assignOwner.isPending ||
		setCompany.isPending ||
		enrich.isPending ||
		archive.isPending;

	return (
		<BulkActionsMenu
			pending={pending || access.loading || access.error}
			open={menuOpen}
			onOpenChange={setMenuOpen}
		>
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
			<DropdownMenuSub>
				<DropdownMenuSubTrigger disabled={!access.editIds.length}>
					Mover a empresa ({access.editIds.length})
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent
					className="w-64 p-0"
					onFocus={(event) => {
						if (event.target === event.currentTarget) {
							companySearch.current?.focus();
						}
					}}
				>
					<CompanyMenuSearch
						none="No company"
						inputRef={companySearch}
						onSelect={(companyId) => {
							setMenuOpen(false);
							if (access.editIds.length)
								setCompany.mutate({ ids: access.editIds, companyId });
						}}
					/>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
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
