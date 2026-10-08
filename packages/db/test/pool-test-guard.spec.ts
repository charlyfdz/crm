import { describe, expect, it } from "bun:test";
import { isolatedPoolTestUrl } from "./pool-test-config";

describe("disposable pool test database guard", () => {
	it("accepts an explicit loopback test database", () => {
		const url =
			"postgresql://synthetic:generated@127.0.0.1:55439/crm_pool_recovery_test";
		expect(isolatedPoolTestUrl(url)).toBe(url);
	});

	it("rejects a missing URL instead of using DATABASE_URL", () => {
		expect(() => isolatedPoolTestUrl(undefined)).toThrow("TEST_DATABASE_URL");
	});

	it("rejects live names, remote hosts, and destination overrides", () => {
		for (const url of [
			"not a URL",
			"postgresql://synthetic:generated@127.0.0.1:55439/crm",
			"postgresql://synthetic:generated@db.example.invalid/crm_test",
			"postgresql://synthetic:generated@localhost/crm_test",
			"https://127.0.0.1/crm_test",
			"postgresql://127.0.0.1/crm_test?host=db.example.invalid",
			"postgresql://127.0.0.1/crm_test?dbname=crm",
			"postgresql://127.0.0.1/crm_test#private",
		]) {
			expect(() => isolatedPoolTestUrl(url)).toThrow();
		}
	});

	it("does not include rejected URLs or credentials in errors", () => {
		try {
			isolatedPoolTestUrl(
				"postgresql://private:secret@remote.invalid/crm_test",
			);
			throw new Error("Unsafe URL was accepted.");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			if (!(error instanceof Error)) throw error;
			expect(error.message).not.toContain("secret");
			expect(error.message).not.toContain("remote.invalid");
		}
	});
});
