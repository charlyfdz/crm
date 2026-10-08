import { DEFAULT_WORKSPACE_NAME } from "@crm/auth";
import { isAiEnabled } from "@crm/env/features";
import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
	title: "Configurar empresa",
};

export const instant = false;

export default async function OnboardingPage() {
	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading
				title="Configura tu empresa"
				description="Esta instalación pertenece a una sola empresa. Administra clientes, contactos, oportunidades y actividades de forma manual."
			/>

			<OnboardingForm
				placeholder={DEFAULT_WORKSPACE_NAME}
				aiEnabled={isAiEnabled()}
			/>
		</AuthShell>
	);
}
