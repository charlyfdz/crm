import "reflect-metadata";
import { describe, expect, it } from "bun:test";
import { validateEnv } from "../src/config/env.validation";

const required = {
	DATABASE_URL: "postgresql://unused:unused@127.0.0.1:5441/config_test",
	BETTER_AUTH_SECRET: "synthetic-config-test-secret-with-32-characters",
	ALLOWED_SIGN_IN: "example.test",
	NODE_ENV: "test",
};

describe("corporate environment contract", () => {
	it("accepts a local-only installation without external providers", () => {
		const result = validateEnv(required);
		expect(result.CRM_AI_ENABLED).toBeUndefined();
		expect(result.CRM_TELEMETRY_ENABLED).toBeUndefined();
		expect(result.GOOGLE_CLIENT_ID).toBeUndefined();
	});

	it("preserves explicit opt-in values", () => {
		const result = validateEnv({
			...required,
			CRM_AI_ENABLED: "false",
			CRM_TELEMETRY_ENABLED: "false",
			DATABASE_POOL_MAX: "5",
		});
		expect(result.CRM_AI_ENABLED).toBe("false");
		expect(result.CRM_TELEMETRY_ENABLED).toBe("false");
		expect(result.DATABASE_POOL_MAX).toBe("5");
	});

	it.each([
		["DATABASE_POOL_MAX", "101"],
		["DATABASE_POOL_CONNECTION_TIMEOUT_MS", "0"],
		["DATABASE_POOL_IDLE_TIMEOUT_MS", "1.5"],
		["DATABASE_POOL_MAX_LIFETIME_SECONDS", "2147484"],
		["DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS", "-1"],
	])("rejects an invalid %s before startup", (name, value) => {
		expect(() => validateEnv({ ...required, [name]: value })).toThrow(name);
	});

	it("uses pool defaults for blank values", () => {
		expect(validateEnv({ ...required, DATABASE_POOL_MAX: "" }).DATABASE_POOL_MAX).toBe("");
	});

	it("does not expose database credentials in pool errors", () => {
		try {
			validateEnv({ ...required, DATABASE_POOL_MAX: "invalid" });
			throw new Error("Validation did not fail.");
		} catch (error) {
			expect(String(error)).not.toContain(required.DATABASE_URL);
		}
	});
});
