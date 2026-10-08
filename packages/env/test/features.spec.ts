import { afterEach, describe, expect, it } from "bun:test";
import {
	aiFeaturePolicy,
	AiDisabledError,
	isAiEnabled,
	requireAiEnabled,
} from "../src/features";

const original = process.env.CRM_AI_ENABLED;

afterEach(() => {
	if (original === undefined) delete process.env.CRM_AI_ENABLED;
	else process.env.CRM_AI_ENABLED = original;
});

describe("installation AI opt-in", () => {
	it("defaults to disabled without loading configuration files", () => {
		expect(aiFeaturePolicy({})).toMatchObject({
			enabled: false,
			status: "disabled",
			code: "CRM_AI_DISABLED",
			flag: "CRM_AI_ENABLED",
		});
	});

	it.each(["", "false", "0", "1", "TRUE", "True", "yes", "on", " true", "true "])(
		"refuses non-literal opt-in %j",
		(value) => {
			expect(isAiEnabled({ CRM_AI_ENABLED: value })).toBe(false);
			expect(() => requireAiEnabled({ CRM_AI_ENABLED: value })).toThrow(
				AiDisabledError,
			);
		},
	);

	it("enables only with the literal true", () => {
		expect(aiFeaturePolicy({ CRM_AI_ENABLED: "true" })).toEqual({
			enabled: true,
			status: "enabled",
		});
		expect(() => requireAiEnabled({ CRM_AI_ENABLED: "true" })).not.toThrow();
	});

	it("does not infer permission from provider credentials", () => {
		const env = {
			CRM_AI_ENABLED: undefined,
			AI_GATEWAY_API_KEY: "synthetic-gateway-key",
			PERPLEXITY_API_KEY: "synthetic-research-key",
			OPENAI_API_KEY: "synthetic-local-key",
		};
		expect(isAiEnabled(env)).toBe(false);
	});

	it("reads the current process flag on every call", () => {
		delete process.env.CRM_AI_ENABLED;
		expect(isAiEnabled()).toBe(false);
		process.env.CRM_AI_ENABLED = "true";
		expect(isAiEnabled()).toBe(true);
		process.env.CRM_AI_ENABLED = "false";
		expect(aiFeaturePolicy().status).toBe("disabled");
	});

	it("refuses work before a provider or queue callback starts", async () => {
		let calls = 0;
		const run = async () => {
			requireAiEnabled({});
			calls += 1;
		};
		await expect(run()).rejects.toMatchObject({
			code: "CRM_AI_DISABLED",
			status: "disabled",
		});
		expect(calls).toBe(0);
	});
});
