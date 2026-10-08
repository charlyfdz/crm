import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ADMISSION, validateAdmission } from "./admission.mjs";
import { repositoryRoot } from "./config.mjs";
import { migrationSteps } from "./migration-plan.mjs";
import {
	assertQuiescent,
	operationPlan,
	validateManifest,
} from "./operation-contract.mjs";
import { validateContract } from "./preflight.mjs";
import { cpuCount, memoryBytes, validateResources } from "./resources.mjs";

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
		CRM_REDIS_MAXMEMORY: "64m",
		...Object.fromEntries(
			["POSTGRES", "REDIS", "APP", "API", "CRON", "MIGRATE"].flatMap((name) => [
				[`CRM_${name}_MEMORY_LIMIT`, "128m"],
				[`CRM_${name}_CPU_LIMIT`, "0.1"],
			]),
		),
	};
}

test("repository root points to this checkout, not its parent", () => {
	assert.ok(existsSync(resolve(repositoryRoot, "deploy/compose.yml")));
	assert.ok(
		existsSync(resolve(repositoryRoot, "packages/db/prisma/schema.prisma")),
	);
});

for (const value of [
	undefined,
	"",
	"0",
	"0m",
	"-1m",
	"1.5g",
	"1tb",
	"Infinity",
	"1m\n",
	"1024;id",
]) {
	test(`memory contract rejects ${JSON.stringify(value)}`, () =>
		assert.throws(() => memoryBytes(value)));
}

test("memory parser uses binary units and accepts case-insensitive units", () => {
	assert.equal(memoryBytes("128M"), 128 * 1024 ** 2);
	assert.equal(memoryBytes("1g"), 1024 ** 3);
	assert.equal(memoryBytes("1024"), 1024);
});

for (const value of [
	undefined,
	"",
	"0",
	"-1",
	"Infinity",
	"NaN",
	"1e2",
	"1;id",
]) {
	test(`CPU contract rejects ${JSON.stringify(value)}`, () =>
		assert.throws(() => cpuCount(value)));
}

test("resource contract checks two operating phases without granting capacity admission", () => {
	const result = validateResources(fixture());
	assert.equal(result.capacityAdmission, false);
	assert.equal(result.phases.length, 2);
	assert.throws(
		() => validateResources({ ...fixture(), CRM_APP_MEMORY_LIMIT: "3g" }),
		/shared pool/,
	);
	assert.throws(
		() => validateResources({ ...fixture(), CRM_API_CPU_LIMIT: "4" }),
		/shared pool/,
	);
	assert.throws(
		() => validateResources({ ...fixture(), CRM_MIGRATE_MEMORY_LIMIT: "3g" }),
		/shared pool/,
	);
	assert.throws(
		() => validateResources({ ...fixture(), CRM_REDIS_MAXMEMORY: "128m" }),
		/headroom/,
	);
});

test("production preflight rejects HTTP and an ambiguous same-origin topology", () => {
	assert.throws(
		() =>
			validateContract({
				...fixture(),
				APP_URL: "http://127.0.0.1:3000",
				API_URL: "http://127.0.0.1:3001",
			}),
		/HTTPS/,
	);
	assert.equal(
		validateContract(
			{
				...fixture(),
				APP_URL: "http://127.0.0.1:3000",
				API_URL: "http://127.0.0.1:3001",
				AUTH_COOKIE_DOMAIN: "",
			},
			false,
			true,
		),
		true,
	);
	assert.throws(
		() => validateContract({ ...fixture(), API_URL: fixture().APP_URL }),
		/separate origins/,
	);
	assert.throws(
		() => validateContract({ ...fixture(), AUTH_COOKIE_DOMAIN: "invalid" }),
		/installation-specific/,
	);
});

test("preflight fails closed on missing limits and ambiguous AI enablement", () => {
	assert.throws(
		() => validateContract({ ...fixture(), CRM_APP_MEMORY_LIMIT: undefined }),
		/Memory/,
	);
	assert.throws(
		() => validateContract({ ...fixture(), CRM_AI_ENABLED: "TRUE" }),
		/true or false/,
	);
	assert.throws(
		() =>
			validateContract(
				{
					...fixture(),
					AGENT_URL: "http://agent:2000",
					AGENT_BRIDGE_SECRET: "f".repeat(64),
				},
				true,
			),
		/explicit/,
	);
});

test("backup plans never include source replacement or database deletion", () => {
	const plan = operationPlan("backup", "fixture.dump", fixture());
	assert.equal(plan.database, "fixture");
	assert.equal(plan.sourceUnchanged, true);
	assert.deepEqual(plan.steps, [
		"verify-quiescence",
		"table-counts",
		"custom-format-dump",
		"checksum-manifest",
	]);
});

test("restore plans require new databases and preserve the source", () => {
	assert.throws(
		() => operationPlan("restore-new", "fixture.dump", fixture(), "fixture"),
		/never overwrites/,
	);
	for (const name of [
		undefined,
		"postgres",
		"template0",
		"template1",
		"unsafe; DROP DATABASE fixture",
		"../outside",
	]) {
		assert.throws(() =>
			operationPlan("restore-new", "fixture.dump", fixture(), name),
		);
	}
	const plan = operationPlan(
		"restore-drill",
		"fixture.dump",
		fixture(),
		undefined,
		20261002,
	);
	assert.equal(plan.database, "crm_restore_20261002_test");
	assert.ok(
		plan.steps.indexOf("schema-check") <
			plan.steps.indexOf("application-grants"),
	);
	assert.equal(plan.sourceUnchanged, true);
});

test("restore requires matching checksum, release, and installation", () => {
	const digest = "f".repeat(64);
	const manifest = {
		formatVersion: 1,
		sha256: digest,
		installation: "synthetic_fixture",
		release: "fixture-1",
		rowCounts: "public.User:0",
		images: [],
	};
	assert.equal(validateManifest(manifest, fixture(), digest), true);
	assert.throws(
		() => validateManifest(manifest, fixture(), "a".repeat(64)),
		/checksum/,
	);
	assert.throws(
		() =>
			validateManifest(
				{ ...manifest, installation: "other_company" },
				fixture(),
				digest,
			),
		/another installation/,
	);
	assert.throws(
		() =>
			validateManifest(
				{ ...manifest, release: "fixture-2" },
				fixture(),
				digest,
			),
		/exact source release/,
	);
	assert.throws(
		() =>
			validateManifest({ ...manifest, formatVersion: 0 }, fixture(), digest),
		/unsupported/,
	);
});

test("database operations reject running writers and missing PostgreSQL", () => {
	assert.doesNotThrow(() => assertQuiescent(["postgres", "redis"]));
	assert.throws(() => assertQuiescent(["redis"]), /PostgreSQL/);
	for (const writer of [
		"api",
		"app",
		"cron",
		"agent",
		"migrate",
		"unknown_writer",
	]) {
		assert.throws(() => assertQuiescent(["postgres", writer]), /Stop all/);
	}
});

test("migration plans enforce ordered deploy, drift check, and grants", () => {
	const steps = migrationSteps({ role: "fixture_app", database: "fixture" });
	assert.deepEqual(steps[0].args, ["migrate", "deploy"]);
	assert.equal(steps[1].args[1], "diff");
	assert.deepEqual(steps[2].args, ["db", "execute", "--stdin"]);
	assert.match(steps[2].input, /REVOKE ALL ON DATABASE "fixture" FROM PUBLIC/);
	assert.match(
		steps[2].input,
		/REVOKE INSERT, UPDATE, DELETE ON TABLE public\._prisma_migrations/,
	);
	assert.throws(() =>
		migrationSteps({ role: 'unsafe";DROP ROLE fixture', database: "fixture" }),
	);
	assert.throws(() =>
		migrationSteps({ role: "pg_reserved", database: "fixture" }),
	);
	assert.throws(() =>
		migrationSteps({
			role: "fixture_app",
			database: "fixture",
			checkOnly: true,
			grantOnly: true,
		}),
	);
});

test("restore grants never run new migrations or change restored row contents", () => {
	const check = migrationSteps({
		role: "fixture_app",
		database: "fixture_restore",
		checkOnly: true,
	});
	const grants = migrationSteps({
		role: "fixture_app",
		database: "fixture_restore",
		grantOnly: true,
	});
	assert.equal(check.length, 1);
	assert.equal(check[0].args[1], "diff");
	assert.equal(grants.length, 1);
	assert.equal(grants[0].args[0], "db");
	assert.doesNotMatch(
		grants[0].input,
		/\b(?:DROP|DELETE FROM|TRUNCATE|CREATE TABLE)\b/,
	);
});

test("operations CLI defaults to a plan without Docker, credential reads, or archive writes", () => {
	const archive = resolve(
		repositoryRoot,
		"deploy/.validation/never-created.dump",
	);
	const result = spawnSync(
		process.execPath,
		[
			resolve(repositoryRoot, "deploy/scripts/operations.mjs"),
			"backup",
			archive,
		],
		{
			env: { POSTGRES_DB: "fixture" },
			encoding: "utf8",
		},
	);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).executed, false);
	assert.equal(existsSync(archive), false);
	assert.equal(existsSync(`${archive}.json`), false);
});

test("preflight CLI fails closed without configuration and does not echo secrets", () => {
	const result = spawnSync(
		process.execPath,
		[resolve(repositoryRoot, "deploy/scripts/preflight.mjs")],
		{
			env: { BETTER_AUTH_SECRET: "never-log-this-fixture" },
			encoding: "utf8",
		},
	);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /COMPOSE_PROJECT_NAME is required/);
	assert.doesNotMatch(result.stderr, /never-log-this-fixture/);
});

function admissionFixture() {
	return {
		schemaVersion: 1,
		service: "crm-corporativo",
		company: "Corporativo S&F",
		infrastructureOwner: "Personal-Carlos",
		target: "homelab/paas-control/Coolify",
		deploymentAuthorized: true,
		approvalEvidence: "synthetic test reference",
		checks: Object.fromEntries(ADMISSION.checks.map((key) => [key, "passed"])),
		exposure: "private-https-tailnet",
		lifecycleAccepted: true,
		origins: {
			app: fixture().APP_URL,
			api: fixture().API_URL,
			cookieDomain: fixture().AUTH_COOKIE_DOMAIN,
		},
		capacity: {
			recordedAt: "2026-10-02T12:00:00Z",
			synthetic: false,
			evidence: "synthetic test reference",
			otherNoncoreMemoryBytes: 0,
			otherNoncoreCpuLimits: 0,
			guestFreeGiB: 40,
			projectedHostFreeGiB: 200,
		},
		backup: {
			restoreVerified: true,
			locationEvidence: "synthetic test reference",
			rpo: "test",
			rto: "test",
			usesRejectedDisk: false,
		},
	};
}

function pinnedFixture() {
	return {
		...fixture(),
		...Object.fromEntries(
			ADMISSION.imageVariables.map((key) => [
				key,
				`fixture.invalid/image@sha256:${"f".repeat(64)}`,
			]),
		),
	};
}

test("admission validates declarations without treating the shared pool as available capacity", () => {
	const record = admissionFixture();
	const now = Date.parse("2026-10-02T13:00:00Z");
	assert.equal(validateAdmission(record, pinnedFixture(), false, now), true);
	assert.throws(
		() =>
			validateAdmission(
				{ ...record, deploymentAuthorized: false },
				pinnedFixture(),
				false,
				now,
			),
		/authorization/,
	);
	assert.throws(
		() =>
			validateAdmission(
				{ ...record, lifecycleAccepted: false },
				pinnedFixture(),
				false,
				now,
			),
		/lifecycle/,
	);
	assert.throws(
		() =>
			validateAdmission(
				{ ...record, checks: { ...record.checks, completeVersion: "pending" } },
				pinnedFixture(),
				false,
				now,
			),
		/acceptance/,
	);
	assert.throws(
		() =>
			validateAdmission(
				{
					...record,
					capacity: {
						...record.capacity,
						otherNoncoreMemoryBytes: 2 * 1024 ** 3,
					},
				},
				pinnedFixture(),
				false,
				now,
			),
		/other workloads/,
	);
	assert.throws(
		() =>
			validateAdmission(
				{ ...record, capacity: { ...record.capacity, guestFreeGiB: 39 } },
				pinnedFixture(),
				false,
				now,
			),
		/Disk/,
	);
});

test("admission rejects stale, synthetic, unpinned, and unsafe recovery records", () => {
	const record = admissionFixture();
	const now = Date.parse("2026-10-02T13:00:00Z");
	assert.throws(
		() => validateAdmission(record, fixture(), false, now),
		/digest/,
	);
	assert.throws(
		() =>
			validateAdmission(
				record,
				pinnedFixture(),
				false,
				Date.parse("2026-10-04T13:00:00Z"),
			),
		/current measured/,
	);
	assert.throws(
		() =>
			validateAdmission(
				{ ...record, capacity: { ...record.capacity, synthetic: true } },
				pinnedFixture(),
				false,
				now,
			),
		/synthetic/,
	);
	assert.throws(
		() =>
			validateAdmission(
				{ ...record, backup: { ...record.backup, usesRejectedDisk: true } },
				pinnedFixture(),
				false,
				now,
			),
		/rejected disk/,
	);
	assert.throws(
		() =>
			validateAdmission(
				{
					...record,
					origins: { ...record.origins, api: "https://other.fixture.invalid" },
				},
				pinnedFixture(),
				false,
				now,
			),
		/Origins/,
	);
});
