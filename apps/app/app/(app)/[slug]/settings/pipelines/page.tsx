import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { PipelineSettings } from "@/components/pipelines/pipeline-settings";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Procesos comerciales" };

export default function PipelinesPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Procesos comerciales</PageShellTitle>
					<PageShellDescription>
						Configura las etapas de cada proceso y conserva el historial de las
						oportunidades.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Settings />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Settings() {
	await requireSession();
	await getServerQueryClient().prefetchQuery(
		getServerTrpc().pipelines.list.queryOptions(),
	);
	return (
		<HydrateClient>
			<div className="flex max-w-3xl flex-col gap-6">
				<PipelineSettings />
			</div>
		</HydrateClient>
	);
}
