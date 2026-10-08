import { afterEach, describe, expect, it, mock } from "bun:test";
import type { Db } from "@crm/db";
import { ContextMode } from "@crm/db/settings";
import { TRPCError } from "@trpc/server";

mock.module("../src/backfill/backfill.service", () => ({
	BackfillService: class {},
}));
mock.module("../src/settings/model-catalog.service", () => ({
	ModelCatalogService: class {},
}));
mock.module("../src/agent/research-key.service", () => ({
	ResearchKeyService: class {},
}));

const { SettingsService } = await import("../src/settings/settings.service");
const { researchKeyOutput } = await import(
	"../src/settings/settings.contracts"
);
const { validateEnv } = await import("../src/config/env.validation");
const originalMode = process.env.CRM_CONTEXT_MODE;
afterEach(() => {
	if (originalMode === undefined) delete process.env.CRM_CONTEXT_MODE;
	else process.env.CRM_CONTEXT_MODE = originalMode;
});

function fixture() {
	const findUnique = mock(async () => ({
		contextDevApiKey: "synthetic-key-1234",
	}));
	const upsert = mock(async () => ({}));
	const verify = mock(async () => ({ outcome: "valid" as const }));
	const run = mock(async () => ({ queued: 0, remaining: 0 }));
	const service = new SettingsService(
		{ appSetting: { findUnique, upsert } } as unknown as Db,
		{} as ConstructorParameters<typeof SettingsService>[1],
		{ verify } as unknown as ConstructorParameters<typeof SettingsService>[2],
		{ run } as unknown as ConstructorParameters<typeof SettingsService>[3],
	);
	return { service, findUnique, upsert, verify, run };
}

describe("Context settings without vendor access", () => {
	it("returns a truthful disabled state without reading or exposing a key", async () => {
		process.env.CRM_CONTEXT_MODE = "disabled";
		const { service, findUnique } = fixture();
		expect(researchKeyOutput.parse(await service.researchKey())).toEqual({
			mode: "disabled",
			configured: false,
			hint: null,
		});
		expect(findUnique).not.toHaveBeenCalled();
	});
	it("rejects saving before verification, database writes or backfill", async () => {
		process.env.CRM_CONTEXT_MODE = "disabled";
		const { service, verify, upsert, run, findUnique } = fixture();
		try {
			await service.setResearchKey("synthetic-new-key");
			throw new Error("The disabled operation was accepted");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
		}
		for (const operation of [verify, upsert, run, findUnique])
			expect(operation).not.toHaveBeenCalled();
	});
	it("retains the enabled save behavior", async () => {
		process.env.CRM_CONTEXT_MODE = "enabled";
		const { service, verify, upsert, run } = fixture();
		const result = await service.setResearchKey("synthetic-new-key");
		expect(result.mode).toBe("enabled");
		expect(result.configured).toBe(true);
		expect(result.hint).not.toContain("synthetic");
		expect(verify).toHaveBeenCalledTimes(1);
		expect(upsert).toHaveBeenCalledTimes(1);
		expect(run).toHaveBeenCalledWith("companies");
	});
	it("validates the new mode at API startup", () => {
		const config = {
			DATABASE_URL: "synthetic-not-a-connection",
			BETTER_AUTH_SECRET: "synthetic-value-with-at-least-32-characters",
			ALLOWED_SIGN_IN: "owner@example.test",
		};
		expect(validateEnv(config).CRM_CONTEXT_MODE).toBe(ContextMode.Enabled);
		expect(
			validateEnv({ ...config, CRM_CONTEXT_MODE: "disabled" }).CRM_CONTEXT_MODE,
		).toBe(ContextMode.Disabled);
		expect(() => validateEnv({ ...config, CRM_CONTEXT_MODE: "off" })).toThrow(
			"CRM_CONTEXT_MODE",
		);
	});
});
