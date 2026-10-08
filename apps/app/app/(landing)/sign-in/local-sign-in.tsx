"use client";

import { signIn } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function LocalSignIn() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (pending) return;
		const data = new FormData(event.currentTarget);
		const email = String(data.get("email") ?? "").trim();
		const password = String(data.get("password") ?? "");
		setPending(true);
		setError(null);
		try {
			const result = await signIn.email({ email, password, rememberMe: false });
			if (result.error) {
				setError("No se pudo iniciar sesión. Comprueba tus datos o solicita acceso al administrador.");
				return;
			}
			router.replace("/");
			router.refresh();
		} catch {
			setError("El servicio de acceso no responde. Intenta de nuevo o contacta al administrador.");
		} finally {
			setPending(false);
		}
	}

	return (
		<form onSubmit={submit} aria-busy={pending}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="local-email">Correo de la empresa</FieldLabel>
					<Input id="local-email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} />
				</Field>
				<Field>
					<FieldLabel htmlFor="local-password">Contraseña</FieldLabel>
					<Input id="local-password" name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={pending} />
				</Field>
				{error ? <FieldError role="alert" aria-live="polite">{error}</FieldError> : null}
				<Field>
					<Button type="submit" disabled={pending}>
						{pending ? <Spinner data-icon="inline-start" /> : null}
						{pending ? "Iniciando sesión…" : "Iniciar sesión"}
					</Button>
					<FieldDescription>El administrador crea las cuentas y recupera el acceso. El registro público está cerrado.</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	);
}
