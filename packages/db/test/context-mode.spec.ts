import { afterEach, describe, expect, it, mock } from "bun:test";
import type { Db } from "../src/client";
import {
	ContextMode,
	readContextDevKey,
	readContextMode,
	writeContextDevKey,
} from "../src/settings";

const originalMode = process.env.CRM_CONTEXT_MODE;
afterEach(() => {
	if (originalMode === undefined) delete process.env.CRM_CONTEXT_MODE;
	else process.env.CRM_CONTEXT_MODE = originalMode;
});

function fixture() {
	const findUnique = mock(async () => ({
		contextDevApiKey: " synthetic-key-1234 ",
	}));
	const upsert = mock(async () => ({}));
	return {
		db: { appSetting: { findUnique, upsert } } as unknown as Db,
		findUnique,
		upsert,
	};
}

describe("operator Context mode", () => {
	it("keeps the original default and accepts explicit modes", () => {
		delete process.env.CRM_CONTEXT_MODE;
		expect(readContextMode()).toBe(ContextMode.Enabled);
		expect(readContextMode("enabled")).toBe(ContextMode.Enabled);
		expect(readContextMode("disabled")).toBe(ContextMode.Disabled);
	});
	it("rejects invalid values without echoing the value", () => {
		for (const value of [
			"",
			"off",
			"DISABLED",
			" disabled ",
			"synthetic-sensitive-value",
		]) {
			expect(() => readContextMode(value)).toThrow(
				"CRM_CONTEXT_MODE must be enabled or disabled.",
			);
		}
	});
	it("does not even read a stored key while disabled", async () => {
		process.env.CRM_CONTEXT_MODE = "disabled";
		const { db, findUnique } = fixture();
		expect(await readContextDevKey(db)).toBeNull();
		expect(findUnique).not.toHaveBeenCalled();
	});
	it("refuses a direct key write while disabled", async () => {
		process.env.CRM_CONTEXT_MODE = "disabled";
		const { db, upsert } = fixture();
		await expect(writeContextDevKey(db, "synthetic-new-key")).rejects.toThrow(
			"disabled by the operator",
		);
		expect(upsert).not.toHaveBeenCalled();
	});
	it("keeps the stored key available when re-enabled without rewriting it", async () => {
		const { db, upsert } = fixture();
		process.env.CRM_CONTEXT_MODE = "disabled";
		expect(await readContextDevKey(db)).toBeNull();
		process.env.CRM_CONTEXT_MODE = "enabled";
		expect(await readContextDevKey(db)).toBe("synthetic-key-1234");
		expect(upsert).not.toHaveBeenCalled();
	});
	it("refuses reads and writes on invalid configuration", async () => {
		process.env.CRM_CONTEXT_MODE = "off";
		const { db, findUnique, upsert } = fixture();
		await expect(readContextDevKey(db)).rejects.toThrow("CRM_CONTEXT_MODE");
		await expect(writeContextDevKey(db, "synthetic-key")).rejects.toThrow(
			"CRM_CONTEXT_MODE",
		);
		expect(findUnique).not.toHaveBeenCalled();
		expect(upsert).not.toHaveBeenCalled();
	});
});
