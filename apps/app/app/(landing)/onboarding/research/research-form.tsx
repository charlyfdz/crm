"use client";

import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function ResearchForm({
	aiEnabled = false,
	signupUrl,
}: {
	aiEnabled?: boolean;
	signupUrl: string;
}) {
	const trpc = useTRPC();
	const router = useRouter();

	const keyId = useId();
	const [apiKey, setApiKey] = useState("");
	const key = useQuery({
		...trpc.settings.researchKey.queryOptions(),
		enabled: aiEnabled,
	});

	const save = useMutation(
		trpc.settings.setResearchKey.mutationOptions({
			onSuccess: () => {
				setApiKey("");
				router.replace("/");
				router.refresh();
			},
			onError: () =>
				toast.error(
					"No se pudo guardar la clave. Revisa la clave e inténtalo de nuevo. Puedes continuar sin IA.",
				),
		}),
	);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (!aiEnabled || save.isPending) return;
				save.mutate({ apiKey: apiKey.trim() });
			}}
			className="flex flex-col gap-6"
		>
			<Alert>
				<AlertTitle>
					{aiEnabled ? "IA habilitada, uso opcional" : "IA desactivada"}
				</AlertTitle>
				<AlertDescription>
					{aiEnabled
						? "La investigación requiere un agente disponible y los proveedores configurados. Una clave guardada no confirma que el agente esté activo."
						: "El CRM está disponible para uso manual. El administrador debe habilitar la IA antes de guardar una clave desde esta pantalla."}
				</AlertDescription>
			</Alert>

			{aiEnabled ? (
				<p className="text-muted-foreground text-sm" role="status">
					{key.isError
						? "No se pudo consultar el estado de la clave. Puedes continuar sin IA."
						: key.isPending
							? "Consultando el estado de la clave…"
							: key.data?.configured
								? "Hay una clave guardada. Esto no confirma la disponibilidad del agente."
								: "No hay una clave guardada. El uso manual sigue disponible."}
				</p>
			) : null}

			<FieldGroup>
				<Field data-disabled={!aiEnabled || save.isPending}>
					<FieldLabel htmlFor={keyId}>Clave API de Context.dev</FieldLabel>
					<Input
						id={keyId}
						name="apiKey"
						type="password"
						value={apiKey}
						onChange={(event) => setApiKey(event.target.value)}
						placeholder="Pega una clave nueva"
						autoComplete="off"
						autoCapitalize="off"
						autoCorrect="off"
						spellCheck={false}
						minLength={8}
						maxLength={500}
						pattern="\S{8,500}"
						disabled={!aiEnabled || save.isPending}
						required
					/>
					<FieldDescription>
						Obtén una clave en{" "}
						<a
							href={signupUrl}
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-4 hover:text-foreground"
						>
							Context.dev
						</a>
						. Guardarla permite su verificación con el proveedor cuando la IA
						está habilitada. La investigación externa utiliza datos de empresas.
					</FieldDescription>
				</Field>
			</FieldGroup>

			<div className="flex flex-col gap-2">
				<Button asChild>
					<a href="/">Continuar sin IA</a>
				</Button>
				<Button type="submit" variant="outline" disabled={!aiEnabled || save.isPending}>
					{save.isPending ? <Spinner data-icon="inline-start" /> : null}
					Guardar clave opcional
				</Button>
			</div>
		</form>
	);
}
