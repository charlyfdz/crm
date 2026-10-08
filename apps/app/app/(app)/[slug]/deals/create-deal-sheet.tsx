"use client";

import Add from "@carbon/icons-react/es/Add";
import { CURRENCIES } from "@crm/db/currency";
import { Button } from "@crm/ui/components/button";
import { DatePicker } from "@crm/ui/components/date-picker";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@crm/ui/components/sheet";
import { Spinner } from "@crm/ui/components/spinner";
import { parseDealAmount } from "@crm/validation/deal-money";
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseAsBoolean, useQueryState } from "nuqs";
import { type ComponentProps, Suspense, useId, useState } from "react";
import { toast } from "sonner";
import { CompanyPicker } from "@/components/crm/company-picker";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { initialPipelineSelection } from "@/components/pipelines/pipeline-model";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

const UNSET = "";

function AddButton(props: ComponentProps<typeof Button>) {
	return (
		<Button {...props}>
			<Icon icon={Add} data-icon="inline-start" />
			Nueva oportunidad
		</Button>
	);
}

export function CreateDealSheet({ companyId }: { companyId?: string }) {
	return (
		<Suspense fallback={<AddButton disabled />}>
			<CreateDealForm companyId={companyId} />
		</Suspense>
	);
}

function CreateDealForm({ companyId }: { companyId?: string }) {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [open, setOpen] = useQueryState(
		SEARCH_PARAM.dialog.create,
		parseAsBoolean.withDefault(false),
	);
	const [name, setName] = useState("");
	const [company, setCompany] = useState(companyId ?? UNSET);
	const [ownerId, setOwnerId] = useState(UNSET);
	const [pipelineId, setPipelineId] = useState(UNSET);
	const [stageId, setStageId] = useState(UNSET);
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState("");
	const [closeDate, setCloseDate] = useState("");

	const nameId = useId();
	const amountId = useId();
	const closeDateId = useId();

	const users = useQuery(trpc.users.list.queryOptions());
	const me = useQuery(trpc.users.me.queryOptions());
	const currencies = useQuery(trpc.currency.settings.queryOptions());
	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const pipelines = useQuery(trpc.pipelines.list.queryOptions());
	const initial = initialPipelineSelection(
		pipelines.data?.rows ?? [],
		pipelineId || undefined,
	);
	const selectedPipeline = pipelines.data?.rows.find(
		(pipeline) => pipeline.id === initial?.pipelineId,
	);
	const resolvedStageId = stageId || initial?.pipelineStageId;
	const selectedStage = selectedPipeline?.stages.find(
		(stage) => stage.id === resolvedStageId && stage.outcome === "OPEN",
	);
	const role = workspace.data?.viewerRole;
	const canAssign = role === "owner" || role === "admin";
	const canCreate = canAssign || role === "member";

	const resolvedOwner = (canAssign ? ownerId : UNSET) || me.data?.id || UNSET;
	const workspaceCurrency = currencies.data?.reportingCurrency;
	const resolvedCurrency = currency || workspaceCurrency || UNSET;

	const create = useMutation(
		trpc.deals.create.mutationOptions({
			onSuccess: async (deal) => {
				await cache.deal(deal.id);
				toast.success(`${deal.name} added.`);
				await setOpen(null);
				setName("");
				setAmount("");
				setCurrency("");
				setCloseDate("");
				setPipelineId(UNSET);
				setStageId(UNSET);
				openRecord({ kind: "deal", id: deal.id });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const ready =
		name.trim() !== "" &&
		company !== UNSET &&
		resolvedOwner !== UNSET &&
		canCreate &&
		Boolean(selectedStage && selectedPipeline && resolvedCurrency) &&
		currencies.isSuccess;

	return (
		<Sheet open={open} onOpenChange={(next) => setOpen(next || null)}>
			<SheetTrigger asChild>
				<AddButton />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>Nueva oportunidad</SheetTitle>
					<SheetDescription>
						La oportunidad necesita empresa, responsable y etapa comercial
						activa.
					</SheetDescription>
				</SheetHeader>

				<form
					id="create-deal"
					className="flex-1 overflow-y-auto px-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (
							!ready ||
							create.isPending ||
							!selectedStage ||
							!selectedPipeline
						)
							return;
						let amountCents: number | null;
						try {
							amountCents = parseDealAmount(amount);
						} catch {
							toast.error(
								"Usa un importe válido con hasta dos decimales y sin separadores de miles.",
							);
							return;
						}
						create.mutate({
							name,
							companyId: company,
							ownerId: resolvedOwner,
							pipelineId: selectedPipeline.id,
							pipelineStageId: selectedStage.id,
							amountCents,
							currency: resolvedCurrency,
							expectedCloseDate: closeDate || null,
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={nameId}>Name</FieldLabel>
							<Input
								id={nameId}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Empresa — Servicio o proyecto"
								autoComplete="off"
								required
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-deal-company">Company</FieldLabel>
							<CompanyPicker
								id="create-deal-company"
								value={company}
								onValueChange={setCompany}
							/>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-deal-owner">Owner</FieldLabel>
							<Select
								value={resolvedOwner}
								onValueChange={setOwnerId}
								disabled={!canAssign || create.isPending}
							>
								<SelectTrigger id="create-deal-owner">
									<SelectValue placeholder="Choose an owner" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{(users.data ?? []).map((user) => (
											<SelectItem key={user.id} value={user.id}>
												{user.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>

						<Field>
							<FieldLabel htmlFor="create-deal-pipeline">
								Proceso comercial
							</FieldLabel>
							<Select
								value={initial?.pipelineId ?? UNSET}
								disabled={!pipelines.isSuccess || create.isPending}
								onValueChange={(next) => {
									setPipelineId(next);
									setStageId(UNSET);
								}}
							>
								<SelectTrigger id="create-deal-pipeline">
									<SelectValue placeholder="Selecciona un proceso" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{(pipelines.data?.rows ?? []).map((pipeline) => (
											<SelectItem key={pipeline.id} value={pipeline.id}>
												{pipeline.name}
												{pipeline.isDefault ? " · Predeterminado" : ""}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="create-deal-stage">
								Etapa comercial
							</FieldLabel>
							<Select
								value={resolvedStageId ?? UNSET}
								onValueChange={setStageId}
								disabled={!selectedPipeline || create.isPending}
							>
								<SelectTrigger id="create-deal-stage">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{(selectedPipeline?.stages ?? [])
											.filter((stage) => stage.outcome === "OPEN")
											.map((stage) => (
												<SelectItem key={stage.id} value={stage.id}>
													{stage.name}
												</SelectItem>
											))}
									</SelectGroup>
								</SelectContent>
							</Select>
							<FieldDescription>
								La oportunidad inicia abierta. Registra el cierre desde su ficha
								después de crearla.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel htmlFor={amountId}>Amount</FieldLabel>
							<div className="flex gap-2">
								<Input
									id={amountId}
									value={amount}
									onChange={(event) => setAmount(event.target.value)}
									placeholder="24000"
									inputMode="decimal"
									autoComplete="off"
								/>
								<Select
									value={resolvedCurrency}
									onValueChange={setCurrency}
									disabled={!currencies.isSuccess || create.isPending}
								>
									<SelectTrigger
										aria-label="Currency"
										className="w-28 shrink-0"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{CURRENCIES.map((entry) => (
												<SelectItem key={entry.code} value={entry.code}>
													{entry.code}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>
						</Field>

						<Field>
							<FieldLabel htmlFor={closeDateId}>Expected close date</FieldLabel>
							<DatePicker
								id={closeDateId}
								value={closeDate}
								onChange={setCloseDate}
								placeholder="No date yet"
							/>
						</Field>
					</FieldGroup>
				</form>

				<SheetFooter>
					<Button
						type="submit"
						form="create-deal"
						disabled={create.isPending || !ready}
					>
						{create.isPending ? <Spinner /> : null}
						Crear oportunidad
					</Button>
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
