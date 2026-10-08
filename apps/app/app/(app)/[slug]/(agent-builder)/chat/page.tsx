import type { Metadata } from "next";
import { Suspense } from "react";
import { AgentBuilderHome } from "@/components/agent-builder/agent-builder-home";
import { AgentBuilderHomeFallback } from "@/components/agent-builder/agent-builder-route-fallback";
import { AiDisabledNotice } from "@/components/ai-disabled-notice";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
	return (
		<Suspense fallback={<AgentBuilderHomeFallback />}>
			<ChatHome />
		</Suspense>
	);
}

async function ChatHome() {
	const session = await requireSession();
	if (!isAiEnabled()) {
		return (
			<main className="flex min-h-0 flex-1 flex-col items-center justify-center p-8">
				<AiDisabledNotice />
			</main>
		);
	}
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();

	await Promise.all([
		queryClient.prefetchQuery(
			trpc.conversations.builderResources.queryOptions({ q: "" }),
		),
		queryClient.prefetchQuery(trpc.google.status.queryOptions()),
	]);

	return (
		<HydrateClient>
			<AgentBuilderHome name={session.user.name} />
		</HydrateClient>
	);
}

import { isAiEnabled } from "@crm/env/features";
