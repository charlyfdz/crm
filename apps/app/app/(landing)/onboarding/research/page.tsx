import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { requireMailboxAccess } from "@/lib/session";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { ResearchForm } from "./research-form";

export const metadata: Metadata = {
	title: "Research key",
};

export const instant = false;

export default async function ResearchKeyPage() {
	await requireMailboxAccess();
	const settings = await getServerTrpcClient().settings.researchKey.query();
	if (settings.mode === "disabled") redirect("/");

	return (
		<AuthShell>
			<AuthHeading
				title="Level up your CRM data"
				description="Power your research agent with Context to research every company added to your CRM."
			/>

			<ResearchForm />
		</AuthShell>
	);
}
