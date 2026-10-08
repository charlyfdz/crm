"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

export function LocalDemoSignIn() {
	const router = useRouter();
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("demo@crm.local.test");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setPending(true);

		try {
			const result =
				mode === "sign-up"
					? await authClient.signUp.email({
							name: name.trim(),
							email: email.trim(),
							password,
							callbackURL: "/",
						})
					: await authClient.signIn.email({
							email: email.trim(),
							password,
							callbackURL: "/",
						});

			if (result.error) {
				setError(result.error.message ?? "No se pudo completar el acceso.");
				return;
			}

			router.replace("/");
			router.refresh();
		} catch {
			setError("No se pudo conectar con el servidor local.");
		} finally {
			setPending(false);
		}
	}

	return (
		<form className="flex flex-col gap-6" onSubmit={submit}>
			<FieldGroup>
				{mode === "sign-up" ? (
					<Field>
						<FieldLabel htmlFor={nameId}>Nombre de prueba</FieldLabel>
						<Input
							autoComplete="name"
							id={nameId}
							maxLength={100}
							name="name"
							onChange={(event) => setName(event.target.value)}
							required
							value={name}
						/>
					</Field>
				) : null}

				<Field>
					<FieldLabel htmlFor={emailId}>Correo local permitido</FieldLabel>
					<Input
						autoComplete="email"
						autoCapitalize="none"
						id={emailId}
						inputMode="email"
						name="email"
						onChange={(event) => setEmail(event.target.value)}
						required
						type="email"
						value={email}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={passwordId}>Contraseña</FieldLabel>
					<Input
						autoComplete={
							mode === "sign-up" ? "new-password" : "current-password"
						}
						id={passwordId}
						minLength={8}
						name="password"
						onChange={(event) => setPassword(event.target.value)}
						required
						type="password"
						value={password}
					/>
					<FieldDescription>
						Usa una contraseña de prueba de ocho caracteres o más.
					</FieldDescription>
				</Field>
			</FieldGroup>

			{error ? (
				<p className="text-sm/5 text-destructive" role="alert">
					{error}
				</p>
			) : null}

			<div className="flex flex-col gap-3">
				<Button className="w-full" disabled={pending} type="submit">
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{mode === "sign-up" ? "Crear cuenta local" : "Iniciar sesión"}
				</Button>
				<Button
					className="w-full"
					disabled={pending}
					onClick={() => {
						setError(undefined);
						setMode(mode === "sign-up" ? "sign-in" : "sign-up");
					}}
					type="button"
					variant="link"
				>
					{mode === "sign-up"
						? "Ya creé una cuenta local"
						: "Crear una cuenta local"}
				</Button>
			</div>
		</form>
	);
}
