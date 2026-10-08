import { aiFeaturePolicy, requireAiEnabled } from "@crm/env/features";
import type { RouteDefinition } from "eve/channels";

export function aiDisabledResponse(): Response | null {
	const policy = aiFeaturePolicy();
	return policy.enabled
		? null
		: Response.json(
				{ ok: false, error: policy.reason, ...policy },
				{ status: 503, headers: { "cache-control": "no-store" } },
			);
}

export function guardAiMessageRoute<TState>(
	route: RouteDefinition<TState>,
): RouteDefinition<TState> {
	if (
		route.method !== "POST" ||
		!/^\/eve\/v1\/session(?:\/:sessionId)?$/.test(route.path)
	) {
		return route;
	}

	return {
		...route,
		handler: async (request, args) =>
			aiDisabledResponse() ?? route.handler(request, args),
	};
}

export function guardAiExecution(): void {
	requireAiEnabled();
}
