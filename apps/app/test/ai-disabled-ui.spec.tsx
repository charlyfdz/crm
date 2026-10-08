import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AiDisabledNotice } from "../components/ai-disabled-notice";
import {
	type BuilderConversationState,
	builderConversationIsWorking,
} from "../lib/agent-builder-state";
import { enrichmentPresentation, isEnriching } from "../lib/enrichment-status";

describe("disabled AI presentation", () => {
	for (const status of [
		"PENDING",
		"RUNNING",
		"COMPLETE",
		"FAILED",
		"SKIPPED",
	] as const) {
		it(`renders ${status} as idle without changing stored status`, () => {
			expect(enrichmentPresentation(status, true, false)).toEqual({
				label: "Investigación desactivada",
				tone: "neutral",
				busy: false,
			});
			expect(isEnriching(status, true, false)).toBe(false);
		});
	}
	it("retains active presentation when enabled", () => {
		expect(isEnriching("RUNNING", false, true)).toBe(true);
		expect(isEnriching("PENDING", true, true)).toBe(true);
		expect(enrichmentPresentation("RUNNING", false, true).busy).toBe(true);
		expect(enrichmentPresentation("PENDING", true, true).label).toBe("Queued");
	});
	for (const status of ["PENDING", "SENDING", "SENT"]) {
		it(`does not claim builder activity for ${status} when disabled`, () => {
			const conversation: BuilderConversationState = {
				ai: { enabled: false },
				sessionId: "session-test",
				continuationToken: null,
				submissions: [{ status }],
				createdVersions: [],
				agent: null,
			};
			expect(builderConversationIsWorking(conversation)).toBe(false);
			expect(conversation.submissions[0]?.status).toBe(status);
			expect(
				builderConversationIsWorking({
					...conversation,
					ai: { enabled: true },
				}),
			).toBe(true);
		});
	}
	it("renders an accessible server-stable notice without a composer", () => {
		const server = renderToStaticMarkup(<AiDisabledNotice />);
		expect(server).toBe(renderToStaticMarkup(<AiDisabledNotice />));
		expect(server).toContain('role="alert"');
		expect(server).toContain("IA desactivada");
		expect(server).toContain("El CRM manual funciona sin IA");
		expect(server).not.toContain("<input");
		expect(server).not.toContain("<textarea");
	});
});
