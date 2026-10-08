"use client";

import Archive from "@carbon/icons-react/es/Archive";
import OverflowMenuVertical from "@carbon/icons-react/es/OverflowMenuVertical";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import Undo from "@carbon/icons-react/es/Undo";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import {
	type ControlledRecord,
	recordControls,
} from "../record-control-policy";
import { useRecordViewer } from "../use-record-viewer";
import {
	type RecordKind,
	type RecordRef,
	useRecordStack,
} from "./record-stack";

const NOUN = {
	company: "empresa",
	contact: "contacto",
	deal: "oportunidad",
} satisfies Record<RecordKind, string>;

const RECORD_PROCEDURES = {
	company: "companies",
	contact: "contacts",
	deal: "deals",
} satisfies Record<RecordKind, "companies" | "contacts" | "deals">;

function useArchiveRecord(record: RecordRef) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const handlers = {
		onSuccess: (archived: { name: string }) => {
			toast.success(
				`${archived.name || `The ${NOUN[record.kind]}`} was archived.`,
			);
			void cache[record.kind](record.id);
		},
		onError: (error: { message: string }) => toast.error(error.message),
	};

	return useMutation(
		trpc[RECORD_PROCEDURES[record.kind]].archive.mutationOptions(handlers),
	);
}

function useRestoreRecord(record: RecordRef) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const handlers = {
		onSuccess: (restored: { name: string }) => {
			toast.success(
				`${restored.name || `The ${NOUN[record.kind]}`} was restored.`,
			);
			void cache[record.kind](record.id);
		},
		onError: (error: { message: string }) => toast.error(error.message),
	};

	return useMutation(
		trpc[RECORD_PROCEDURES[record.kind]].restore.mutationOptions(handlers),
	);
}

function usePurgeRecord(record: RecordRef) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { close } = useRecordStack();

	const handlers = {
		onSuccess: (purged: { name: string }) => {
			toast.success(
				`${purged.name || `The ${NOUN[record.kind]}`} was deleted forever.`,
			);
			void cache.removed(record);
			close();
		},
		onError: (error: { message: string }) => toast.error(error.message),
	};

	return useMutation(
		trpc[RECORD_PROCEDURES[record.kind]].purge.mutationOptions(handlers),
	);
}

export function RecordActions({
	record,
	name,
	consequence,
	archivedAt,
	owner,
}: {
	record: RecordRef;
	name: string;
	consequence: string;
	archivedAt: string | null;
	owner: ControlledRecord["owner"];
}) {
	const { viewer } = useRecordViewer();
	const access = recordControls(viewer, { id: record.id, owner, archivedAt });
	const [confirming, setConfirming] = useState(false);
	const archive = useArchiveRecord(record);
	const restore = useRestoreRecord(record);
	const purge = usePurgeRecord(record);

	const pending = archive.isPending || restore.isPending || purge.isPending;
	if (!access.canArchive && !access.canRestore && !access.canPurge) return null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" disabled={pending}>
						<Icon icon={OverflowMenuVertical} />
						<span className="sr-only">Acciones del registro</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-44">
					<DropdownMenuGroup>
						{access.canRestore ? (
							<DropdownMenuItem
								disabled={pending}
								onSelect={() => {
									if (access.canRestore) restore.mutate({ id: record.id });
								}}
							>
								<Icon icon={Undo} />
								Restaurar {NOUN[record.kind]}
							</DropdownMenuItem>
						) : null}
						{access.canPurge ? (
							<DropdownMenuItem
								variant="destructive"
								disabled={pending}
								onSelect={() => setConfirming(true)}
							>
								<Icon icon={TrashCan} />
								Eliminar {NOUN[record.kind]} definitivamente
							</DropdownMenuItem>
						) : null}
						{access.canArchive ? (
							<DropdownMenuItem
								disabled={pending}
								onSelect={() => {
									if (access.canArchive) archive.mutate({ id: record.id });
								}}
							>
								<Icon icon={Archive} />
								Archivar {NOUN[record.kind]}
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog
				open={confirming && access.canPurge}
				onOpenChange={setConfirming}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							¿Eliminar {name} definitivamente?
						</AlertDialogTitle>
						<AlertDialogDescription>{consequence}</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={pending || !access.canPurge}
							onClick={() => {
								if (access.canPurge && !pending)
									purge.mutate({ id: record.id });
							}}
						>
							Eliminar definitivamente
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
