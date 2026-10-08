import assert from "node:assert/strict";
import test from "node:test";
import { dueJobs } from "./config.mjs";
import { validateContract } from "./preflight.mjs";
import { connectionEnvironment } from "./runtime.mjs";

test("database URL encodes reserved characters and removes input passwords", () => {
	const source = {
		POSTGRES_USER: "fixture@user",
		POSTGRES_DB: "fixture db",
		POSTGRES_PASSWORD: "synthetic/@:#%".repeat(4),
		REDIS_PASSWORD: "synthetic/@:#%".repeat(4),
		DATABASE_URL: "postgresql://unrelated.invalid/ignored",
	};
	const env = connectionEnvironment(source);
	const db = new URL(env.DATABASE_URL);
	assert.equal(db.hostname, "postgres");
	assert.equal(decodeURIComponent(db.username), source.POSTGRES_USER);
	assert.equal(decodeURIComponent(db.password), source.POSTGRES_PASSWORD);
	assert.equal(decodeURIComponent(db.pathname.slice(1)), source.POSTGRES_DB);
	assert.equal(db.searchParams.get("schema"), "public");
	assert.equal(new URL(env.REDIS_URL).hostname, "redis");
	assert.equal(env.POSTGRES_PASSWORD, undefined);
	assert.equal(env.REDIS_PASSWORD, undefined);
	assert.equal(source.POSTGRES_USER, "fixture@user");
});

test("database construction refuses missing or short credentials", () => {
	assert.throws(() => connectionEnvironment({}), /POSTGRES_USER/);
	assert.throws(
		() =>
			connectionEnvironment({
				POSTGRES_USER: "fixture",
				POSTGRES_DB: "fixture",
				POSTGRES_PASSWORD: "short",
			}),
		/32 characters/,
	);
});

test("worker schedules match UTC retention and mailbox windows", () => {
	assert.deepEqual(
		dueJobs(new Date("2026-10-01T06:00:00Z")).map((job) => job.path),
		["/internal/sync/mailboxes", "/internal/sync/rates"],
	);
	assert.deepEqual(
		dueJobs(new Date("2026-10-01T04:00:00Z")).map((job) => job.path),
		["/internal/sync/mailboxes", "/internal/tracking/retention"],
	);
	assert.deepEqual(
		dueJobs(new Date("2026-10-01T05:00:00Z")).map((job) => job.path),
		["/internal/sync/mailboxes", "/internal/archive/prune"],
	);
	assert.equal(dueJobs(new Date("2026-10-01T07:01:00Z")).length, 0);
});

function fixture() {
	return {
		COMPOSE_PROJECT_NAME: "synthetic_fixture",
		CRM_VERSION: "fixture-1",
		POSTGRES_USER: "fixture_owner",
		POSTGRES_DB: "fixture",
		CRM_DB_USER: "fixture_app",
		POSTGRES_PASSWORD: "a".repeat(64),
		CRM_DB_PASSWORD: "b".repeat(64),
		REDIS_PASSWORD: "c".repeat(64),
		BETTER_AUTH_SECRET: "d".repeat(64),
		CRON_SECRET: "e".repeat(64),
		ALLOWED_SIGN_IN: "fixture.invalid",
		APP_URL: "https://crm.fixture.invalid",
		API_URL: "https://api.fixture.invalid",
		AUTH_COOKIE_DOMAIN: "fixture.invalid",
		...Object.fromEntries(
			["POSTGRES", "REDIS", "APP", "API", "CRON", "MIGRATE"].flatMap((name) => [
				[`CRM_${name}_MEMORY_LIMIT`, "128m"],
				[`CRM_${name}_CPU_LIMIT`, "0.1"],
			]),
		),
		CRM_REDIS_MAXMEMORY: "64m",
	};
}

test("preflight accepts an isolated fixture and rejects unsafe origin, shared owner, and reused secrets", () => {
	assert.equal(validateContract(fixture()), true);
	assert.throws(
		() =>
			validateContract({
				...fixture(),
				API_URL: "http://untrusted.invalid:3001",
			}),
		/HTTPS/,
	);
	assert.throws(
		() => validateContract({ ...fixture(), CRM_DB_USER: "fixture_owner" }),
		/separate/,
	);
	assert.throws(
		() => validateContract({ ...fixture(), CRM_DB_PASSWORD: "a".repeat(64) }),
		/separate value/,
	);
	assert.throws(
		() => validateContract({ ...fixture(), CRM_AI_ENABLED: "true" }),
		/agent profile/,
	);
	assert.equal(
		validateContract(
			{
				...fixture(),
				CRM_AI_ENABLED: "true",
				AGENT_URL: "http://agent:2000",
				AGENT_BRIDGE_SECRET: "f".repeat(64),
				CRM_AGENT_MEMORY_LIMIT: "128m",
				CRM_AGENT_CPU_LIMIT: "0.1",
			},
			true,
		),
		true,
	);
});

test("empty optional Compose values disappear before API validation", () => {
	const source = {
		POSTGRES_USER: "fixture",
		POSTGRES_DB: "fixture",
		POSTGRES_PASSWORD: "a".repeat(64),
		AGENT_URL: "",
	};
	assert.equal(connectionEnvironment(source).AGENT_URL, undefined);
});
