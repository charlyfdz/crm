import { afterEach, describe, expect, it, mock } from "bun:test";

const readStoredKey = mock(async () => ({
	contextDevApiKey: "synthetic-stored-key",
}));
mock.module("@crm/db", () => ({
	db: { appSetting: { findUnique: readStoredKey } },
}));

const { contextDev, verifyKey, brandByDomain } = await import(
	"../agent/lib/context-dev"
);
const originalFetch = globalThis.fetch;
const originalMode = process.env.CRM_CONTEXT_MODE;
afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalMode === undefined) delete process.env.CRM_CONTEXT_MODE;
	else process.env.CRM_CONTEXT_MODE = originalMode;
	readStoredKey.mockClear();
});

describe("Context vendor access disabled in an isolated process", () => {
	it("does not query the vendor to verify a candidate key", async () => {
		process.env.CRM_CONTEXT_MODE = "disabled";
		const network = mock(async () => {
			throw new Error("Unexpected vendor request");
		});
		globalThis.fetch = network as unknown as typeof fetch;
		expect(await verifyKey("synthetic-candidate-key")).toEqual({
			outcome: "invalid",
			reason: "Context is disabled by the operator.",
		});
		expect(network).not.toHaveBeenCalled();
		expect(readStoredKey).not.toHaveBeenCalled();
	});
	it("does not read the stored key or look up a company", async () => {
		process.env.CRM_CONTEXT_MODE = "disabled";
		const network = mock(async () => {
			throw new Error("Unexpected vendor request");
		});
		globalThis.fetch = network as unknown as typeof fetch;
		expect(await contextDev()).toBeNull();
		expect((await brandByDomain("example.test")).outcome).toBe("skipped");
		expect(network).not.toHaveBeenCalled();
		expect(readStoredKey).not.toHaveBeenCalled();
	});
	it("discards an existing client when the operator disables Context", async () => {
		process.env.CRM_CONTEXT_MODE = "enabled";
		expect(await contextDev()).not.toBeNull();
		expect(readStoredKey).toHaveBeenCalledTimes(1);
		process.env.CRM_CONTEXT_MODE = "disabled";
		expect(await contextDev()).toBeNull();
		expect(readStoredKey).toHaveBeenCalledTimes(1);
	});
});
