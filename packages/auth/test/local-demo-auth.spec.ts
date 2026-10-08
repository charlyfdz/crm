import { describe, expect, it } from "bun:test";
import { isLocalDemoAuthEnabled } from "../src/local-demo-auth";

describe("isLocalDemoAuthEnabled", () => {
	it("enables local credentials only in explicit development mode", () => {
		expect(
			isLocalDemoAuthEnabled({
				NODE_ENV: "development",
				CRM_LOCAL_DEMO_AUTH: "1",
			}),
		).toBe(true);
	});

	it.each(["production", "test", undefined])(
		"disables local credentials when NODE_ENV is %s",
		(nodeEnv) => {
			expect(
				isLocalDemoAuthEnabled({
					NODE_ENV: nodeEnv,
					CRM_LOCAL_DEMO_AUTH: "1",
				}),
			).toBe(false);
		},
	);

	it.each([undefined, "true", "0", "yes"])(
		"disables local credentials when the flag is %s",
		(flag) => {
			expect(
				isLocalDemoAuthEnabled({
					NODE_ENV: "development",
					CRM_LOCAL_DEMO_AUTH: flag,
				}),
			).toBe(false);
		},
	);
});
