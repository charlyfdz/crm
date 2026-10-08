import { CONTEXT_DEV_SIGNUP_URL } from "@crm/db/settings";
import { isAiEnabled } from "@crm/env/features";
import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { ResearchForm } from "./research-form";

export const metadata: Metadata = {
	title: "IA opcional",
};

export const instant = false;

export default async function ResearchKeyPage() {
	await requireMailboxAccess();

	return (
		<AuthShell>
			<AuthHeading
				title="Investigación con IA, opcional"
				description="Context.dev aporta información externa sobre empresas. El CRM funciona de forma manual sin esta clave ni un agente de IA."
			/>

			<ResearchForm
				aiEnabled={isAiEnabled()}
				signupUrl={CONTEXT_DEV_SIGNUP_URL}
			/>
		</AuthShell>
	);
}
