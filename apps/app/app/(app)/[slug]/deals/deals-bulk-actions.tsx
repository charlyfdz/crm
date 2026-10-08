"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Undo from "@carbon/icons-react/es/Undo";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { formatCount } from "@crm/ui/lib/format";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	BulkActionsMenu,
	BulkDeleteDialog,
	BulkOwnerMenu,
	reportBulk,
} from "@/components/crm/bulk-actions";
import { PIPELINE_EDITOR } from "@/components/pipelines/pipeline-config";
import { stageRequiresReason } from "@/components/pipelines/pipeline-model";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type BulkStage =
	RouterOutputs["pipelines"]["list"]["rows"][number]["stages"][number] & {
		pipelineId: string;
		pipelineName: string;
	};

function deals(count: number): string {
	return formatCount(count, "deal");
}

export function DealsBulkActions({
	ids,
	onDone,
	archived,
}: {
	ids: string[];
	onDone: () => void;
	archived: boolean;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const users = useQuery(trpc.users.list.queryOptions());
	const pipelines = useQuery(trpc.pipelines.list.queryOptions());
	const reasonId = useId();
	const confirmId = useId();
	const [closing, setClosing] = useState<BulkStage | null>(null);
	const [confirmedMove, setConfirmedMove] = useState(false);
	const [reason, setReason] = useState("");
	const [confirming, setConfirming] = useState(false);

	const onError = (error: { message: string }) => toast.error(error.message);

	const assignOwner = useMutation(
		trpc.deals.bulkAssignOwner.mutationOptions({
			onSuccess: async (result) => {
				await cache.deal();
				reportBulk(result, (count) => `${deals(count)} reassigned.`);
				onDone();
			},
			onError,
		}),
	);

	const setStage = useMutation(
		trpc.deals.bulkSetStage.mutationOptions({
			onSuccess: async (result) => {
				await cache.deal();
				reportBulk(result, (count) => `${deals(count)} moved.`);
				setClosing(null);
				setReason("");
				setConfirmedMove(false);
				onDone();
			},
			onError,
		}),
	);

	const archive = useMutation(
		trpc.deals.bulkArchive.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "deal", ids: variables.ids });
				reportBulk(result, (count) => `${deals(count)} archived.`);
				onDone();
			},
			onError,
		}),
	);

	const restore = useMutation(
		trpc.deals.bulkRestore.mutationOptions({
			onSuccess: async (result) => {
				await cache.deal();
				reportBulk(result, (count) => `${deals(count)} restored.`);
				onDone();
			},
			onError,
		}),
	);

	const purge = useMutation(
		trpc.deals.bulkPurge.mutationOptions({
			onSuccess: async (result, variables) => {
				await cache.removedMany({ kind: "deal", ids: variables.ids });
				reportBulk(result, (count) => `${deals(count)} deleted forever.`);
				setConfirming(false);
				onDone();
			},
			onError,
		}),
	);

	if (archived) {
		const archivedPending = restore.isPending || purge.isPending;

		return (
			<>
				<BulkActionsMenu pending={archivedPending}>
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={() => restore.mutate({ ids })}>
							<Undo />
							Restore
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => setConfirming(true)}
						>
							Delete forever
						</DropdownMenuItem>
					</DropdownMenuGroup>
				</BulkActionsMenu>

				<BulkDeleteDialog
					open={confirming}
					onOpenChange={setConfirming}
					title={`Delete ${deals(ids.length)} forever?`}
					description="Everything filed against them — activity, notes, the amounts in your pipeline — goes too. This cannot be undone."
					onConfirm={() => purge.mutate({ ids })}
				/>
			</>
		);
	}

	const pending =
		assignOwner.isPending || setStage.isPending || archive.isPending;

	return (
		<>
			<BulkActionsMenu pending={pending}>
				<BulkOwnerMenu
					users={users.data ?? []}
					onSelect={(ownerId) =>
						ownerId && assignOwner.mutate({ ids, ownerId })
					}
				/>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger disabled={!pipelines.isSuccess}>
						Cambiar etapa
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="max-h-72 overflow-y-auto">
						<DropdownMenuGroup>
							{(pipelines.data?.rows ?? []).flatMap((pipeline) =>
								pipeline.stages.map((option) => (
									<DropdownMenuItem
										key={option.id}
										onSelect={() => {
											setClosing({
												...option,
												pipelineId: pipeline.id,
												pipelineName: pipeline.name,
											});
											setConfirmedMove(false);
										}}
									>
										{pipeline.name} · {option.name}
									</DropdownMenuItem>
								)),
							)}
						</DropdownMenuGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem onSelect={() => archive.mutate({ ids })}>
						<Archive />
						Archive
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</BulkActionsMenu>

			<Dialog
				open={closing !== null}
				onOpenChange={(next) => {
					if (next) return;
					setClosing(null);
					setReason("");
					setConfirmedMove(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Mover {ids.length} oportunidades a {closing?.pipelineName} ·{" "}
							{closing?.name}
						</DialogTitle>
						<DialogDescription>
							El cambio usa la misma etapa y motivo para todas. Cada oportunidad
							conserva su historial. La API comprueba los permisos por registro
							y comunica los fallos parciales.
						</DialogDescription>
					</DialogHeader>

					<form
						id="bulk-close-reason"
						className="px-4"
						onSubmit={(event) => {
							event.preventDefault();
							if (
								!closing ||
								!confirmedMove ||
								setStage.isPending ||
								(stageRequiresReason(closing.outcome) && !reason.trim())
							)
								return;
							setStage.mutate({
								ids,
								pipelineId: closing.pipelineId,
								pipelineStageId: closing.id,
								closedReason: reason,
							});
						}}
					>
						<Field>
							<FieldLabel htmlFor={reasonId}>
								{closing && stageRequiresReason(closing.outcome)
									? "Motivo obligatorio"
									: "Nota del movimiento"}
							</FieldLabel>
							<Textarea
								id={reasonId}
								value={reason}
								maxLength={PIPELINE_EDITOR.reasonLength}
								required={Boolean(
									closing && stageRequiresReason(closing.outcome),
								)}
								onChange={(event) => setReason(event.target.value)}
								placeholder="Budget pulled for the quarter"
								rows={3}
							/>
						</Field>
						<Field orientation="horizontal">
							<Checkbox
								id={confirmId}
								checked={confirmedMove}
								onCheckedChange={(checked) =>
									setConfirmedMove(checked === true)
								}
							/>
							<FieldLabel htmlFor={confirmId}>
								Confirmo la etapa para todas las oportunidades y su traslado a
								este proceso.
							</FieldLabel>
						</Field>
					</form>

					<DialogFooter>
						<Button
							type="submit"
							form="bulk-close-reason"
							disabled={
								setStage.isPending ||
								!confirmedMove ||
								Boolean(
									closing &&
										stageRequiresReason(closing.outcome) &&
										!reason.trim(),
								)
							}
						>
							{setStage.isPending ? <Spinner /> : null}
							Save
						</Button>
						<Button
							variant="outline"
							onClick={() => {
								setClosing(null);
								setReason("");
							}}
						>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
