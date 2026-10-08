"use client";

import { workspaceSlug } from "@crm/db/workspace";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@crm/ui/components/input-group";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { RESEARCH_PATH } from "@/lib/onboarding";
import { useTRPC } from "@/lib/trpc/client";

export function OnboardingForm({
	placeholder,
	aiEnabled = false,
}: {
	placeholder: string;
	aiEnabled?: boolean;
}) {
	const trpc = useTRPC();
	const router = useRouter();

	const nameId = useId();
	const slugId = useId();
	const websiteId = useId();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const slugEdited = useRef(false);

	const save = useMutation(
		trpc.workspace.update.mutationOptions({
			onError: () =>
				toast.error(
					"No se pudo guardar la empresa. Revisa los datos e inténtalo de nuevo.",
				),
		}),
	);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (save.isPending) return;

				const form = new FormData(event.currentTarget);
				const submitter = (event.nativeEvent as SubmitEvent).submitter;
				const destination =
					submitter?.getAttribute("value") === "research" ? RESEARCH_PATH : "/";

				save.mutate(
					{
						name: String(form.get("name") ?? "").trim(),
						slug: workspaceSlug(String(form.get("slug") ?? "")),
						website: String(form.get("website") ?? "").trim(),
					},
					{
						onSuccess: () => {
							router.replace(destination);
							router.refresh();
						},
					},
				);
			}}
			className="flex flex-col gap-6"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={nameId}>Nombre de la empresa</FieldLabel>
					<Input
						id={nameId}
						name="name"
						value={name}
						onChange={(event) => {
							const next = event.target.value;
							setName(next);
							if (!slugEdited.current) setSlug(workspaceSlug(next));
						}}
						placeholder={placeholder}
						autoComplete="organization"
						autoFocus
						maxLength={120}
						disabled={save.isPending}
						required
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={slugId}>Dirección del espacio de trabajo</FieldLabel>
					<InputGroup>
						<InputGroupAddon>
							<InputGroupText>/</InputGroupText>
						</InputGroupAddon>
						<InputGroupInput
							id={slugId}
							name="slug"
							value={slug}
							onChange={(event) => {
								slugEdited.current = true;
								setSlug(workspaceSlugDraft(event.target.value));
							}}
							onBlur={() =>
								setSlug((value) => (value ? workspaceSlug(value) : ""))
							}
							placeholder={workspaceSlug(placeholder)}
							autoComplete="off"
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
							disabled={save.isPending}
							required
						/>
					</InputGroup>
					<FieldDescription>
						Tu equipo usa esta dirección para abrir el CRM de la empresa.
					</FieldDescription>
				</Field>

				<Field>
					<FieldLabel htmlFor={websiteId}>Sitio web</FieldLabel>
					<InputGroup>
						<InputGroupAddon>
							<InputGroupText>https://</InputGroupText>
						</InputGroupAddon>
						<InputGroupInput
							id={websiteId}
							name="website"
							placeholder="empresa.example"
							autoComplete="off"
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
							inputMode="url"
							maxLength={255}
							disabled={save.isPending}
							required
						/>
					</InputGroup>
					<FieldDescription>
						Introduce el dominio de tu empresa. Guardarlo no habilita la IA.
					</FieldDescription>
				</Field>
			</FieldGroup>

			<p className="text-muted-foreground text-sm" role="status">
				{aiEnabled
					? "La IA está habilitada por el administrador, pero es opcional. El uso manual no requiere Context.dev ni un agente."
					: "La IA está desactivada en esta instalación. El uso manual no requiere claves externas ni un agente."}
			</p>

			<div className="flex flex-col gap-2">
				<Button type="submit" name="next" value="manual" disabled={save.isPending}>
					{save.isPending ? <Spinner data-icon="inline-start" /> : null}
					Continuar sin IA
				</Button>
				<Button
					type="submit"
					name="next"
					value="research"
					variant="outline"
					disabled={save.isPending}
				>
					Ver configuración opcional de IA
				</Button>
			</div>
		</form>
	);
}

function workspaceSlugDraft(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+/, "");
}
