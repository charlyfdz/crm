import { describe, expect, it } from "bun:test";
import {
	DATABASE_POOL_DEFAULTS,
	DATABASE_POOL_LIMITS,
	type DatabasePoolEnvironment,
	databasePoolConfig,
} from "../src/pool-config";

describe("persistent database pool configuration", () => {
	it("uses finite connection and eviction limits without preallocating connections", () => {
		const config = databasePoolConfig({});
		expect(config).toEqual(DATABASE_POOL_DEFAULTS);
		expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
		expect(config.idleTimeoutMillis).toBeGreaterThan(0);
		expect(config.maxLifetimeSeconds).toBeGreaterThan(0);
		expect(config.min).toBe(0);
		expect(config.keepAlive).toBe(true);
		expect(config.allowExitOnIdle).toBe(false);
	});

	it("accepts explicit configuration without changing its input or shared defaults", () => {
		const env = Object.freeze({
			DATABASE_POOL_MAX: "4",
			DATABASE_POOL_CONNECTION_TIMEOUT_MS: " 2500 ",
			DATABASE_POOL_IDLE_TIMEOUT_MS: "15000",
			DATABASE_POOL_MAX_LIFETIME_SECONDS: "600",
			DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS: "5000",
		});
		expect(databasePoolConfig(env)).toEqual({
			...DATABASE_POOL_DEFAULTS,
			max: 4,
			connectionTimeoutMillis: 2500,
			idleTimeoutMillis: 15000,
			maxLifetimeSeconds: 600,
			keepAliveInitialDelayMillis: 5000,
		});
		expect(databasePoolConfig({}).max).toBe(10);
	});

	it("treats empty optional values as defaults", () => {
		expect(
			databasePoolConfig({
				DATABASE_POOL_MAX: "",
				DATABASE_POOL_CONNECTION_TIMEOUT_MS: " ",
				DATABASE_POOL_IDLE_TIMEOUT_MS: "\t",
				DATABASE_POOL_MAX_LIFETIME_SECONDS: "",
				DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS: "",
			}),
		).toEqual(DATABASE_POOL_DEFAULTS);
	});

	const names: (keyof DatabasePoolEnvironment)[] = [
		"DATABASE_POOL_MAX",
		"DATABASE_POOL_CONNECTION_TIMEOUT_MS",
		"DATABASE_POOL_IDLE_TIMEOUT_MS",
		"DATABASE_POOL_MAX_LIFETIME_SECONDS",
		"DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS",
	];

	for (const name of names) {
		it(`rejects invalid ${name} without exposing its value`, () => {
			for (const value of [
				"0",
				"-1",
				"1.5",
				"1e2",
				"0x10",
				"10ms",
				"Infinity",
				"NaN",
				"9007199254740992",
				"postgresql://user:secret@localhost/private",
			]) {
				try {
					databasePoolConfig({ [name]: value });
					throw new Error("Invalid configuration was accepted.");
				} catch (error) {
					expect(error).toBeInstanceOf(Error);
					if (!(error instanceof Error)) throw error;
					expect(error.message).toStartWith(`${name} must be`);
					expect(error.message).not.toContain("secret");
				}
			}
		});
	}

	it("accepts the maximum values and rejects timer overflow", () => {
		expect(
			databasePoolConfig({
				DATABASE_POOL_MAX: String(DATABASE_POOL_LIMITS.maxConnections),
				DATABASE_POOL_CONNECTION_TIMEOUT_MS: String(
					DATABASE_POOL_LIMITS.maxTimerMillis,
				),
				DATABASE_POOL_MAX_LIFETIME_SECONDS: String(
					DATABASE_POOL_LIMITS.maxLifetimeSeconds,
				),
			}).max,
		).toBe(DATABASE_POOL_LIMITS.maxConnections);
		expect(() => databasePoolConfig({ DATABASE_POOL_MAX: "101" })).toThrow(
			"DATABASE_POOL_MAX",
		);
		for (const name of names.filter((name) => name !== "DATABASE_POOL_MAX")) {
			const maximum =
				name === "DATABASE_POOL_MAX_LIFETIME_SECONDS"
					? DATABASE_POOL_LIMITS.maxLifetimeSeconds
					: DATABASE_POOL_LIMITS.maxTimerMillis;
			expect(() => databasePoolConfig({ [name]: String(maximum + 1) })).toThrow(
				name,
			);
		}
	});
});
