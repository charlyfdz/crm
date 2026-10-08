import { describe, expect, it } from "bun:test";
import { DISABLE_VARIABLES, telemetryDisabled } from "../src/disabled";

describe("telemetryDisabled", () => {
	it("disables reporting by default", () => {
		expect(telemetryDisabled({})).toBe(true);
	});

	it("requires explicit opt-in", () => {
		expect(telemetryDisabled({ CRM_TELEMETRY_ENABLED: "true" })).toBe(false);
	});

	it("disable switches override opt-in", () => {
		for (const name of DISABLE_VARIABLES) {
			expect(telemetryDisabled({ CRM_TELEMETRY_ENABLED: "true", [name]: "1" })).toBe(true);
		}
	});

	it("sends nothing from a test run, whatever else is set", () => {
			expect(telemetryDisabled({ NODE_ENV: "test", CRM_TELEMETRY_ENABLED: "true" })).toBe(true);
	});

	it("honours CRM_TELEMETRY_DISABLED", () => {
		expect(telemetryDisabled({ CRM_TELEMETRY_DISABLED: "1" })).toBe(true);
	});

	it("honours DO_NOT_TRACK", () => {
		expect(telemetryDisabled({ DO_NOT_TRACK: "1" })).toBe(true);
	});

	it("takes any of the obvious ways to say yes", () => {
		for (const value of ["1", "true", "TRUE", " yes ", "on"]) {
			expect(telemetryDisabled({ DO_NOT_TRACK: value })).toBe(true);
		}
	});

	it("does not read an empty or negative value as a yes", () => {
		for (const value of ["", " ", "0", "false", "no"]) {
			expect(telemetryDisabled({ CRM_TELEMETRY_ENABLED: "true", CRM_TELEMETRY_DISABLED: value })).toBe(false);
		}
	});

	it("names both variables so the docs and the code cannot drift", () => {
		expect(DISABLE_VARIABLES).toEqual([
			"CRM_TELEMETRY_DISABLED",
			"DO_NOT_TRACK",
		]);
	});
});
