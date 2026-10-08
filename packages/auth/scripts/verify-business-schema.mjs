import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const businessMigrations = [
	"20261002210000_configurable_pipelines",
	"20261002210100_assigned_tasks",
];

export function validateBusinessSchemaUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("Run the isolated business-schema harness.");
	}
	if (
		url.protocol !== "postgresql:" ||
		url.hostname !== "127.0.0.1" ||
		!/^\d+$/.test(url.port) ||
		Number(url.port) < 1 ||
		url.pathname !== "/crm_business_schema_test" ||
		url.username !== "postgres" ||
		url.password !== "postgres" ||
		url.search !== "" ||
		url.hash !== ""
	) {
		throw new Error("Run the isolated business-schema harness.");
	}
	return url;
}

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const migrationDirectory = resolve(workspace, "packages/db/prisma/migrations");
const authDirectory = resolve(workspace, "packages/auth");

function childEnvironment(url, nonce) {
	const allowed = new Set([
		"path",
		"systemroot",
		"windir",
		"temp",
		"tmp",
		"comspec",
		"pathext",
		"systemdrive",
	]);
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([key]) =>
			allowed.has(key.toLowerCase()),
		),
	);
	return {
		...env,
		DATABASE_URL: url,
		TEST_DATABASE_URL: url,
		CRM_BUSINESS_SCHEMA_TEST: "1",
		CRM_BUSINESS_SCHEMA_NONCE: nonce,
		CRM_AI_ENABLED: "false",
		CRM_TELEMETRY_ENABLED: "false",
		DO_NOT_TRACK: "1",
		NODE_ENV: "test",
	};
}

async function runTests(env) {
	return new Promise((resolveRun, rejectRun) => {
		const child = spawn(
			"bun",
			[
				"--no-env-file",
				"--no-install",
				"test",
				"test/business-schema.integration.spec.ts",
			],
			{
				cwd: authDirectory,
				env,
				windowsHide: true,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let output = "";
		let terminated = false;
		const timeout = setTimeout(() => {
			terminated = true;
			child.kill();
		}, 60_000);
		const collect = (chunk) => {
			output += chunk.toString();
			if (output.length > 4 * 1024 * 1024) {
				terminated = true;
				child.kill();
			}
		};
		child.stdout.on("data", collect);
		child.stderr.on("data", collect);
		child.on("error", () => {
			clearTimeout(timeout);
			rejectRun(new Error("Cannot start the isolated schema test process."));
		});
		child.on("close", (status) => {
			clearTimeout(timeout);
			const safeOutput = output
				.replaceAll(env.DATABASE_URL, "[isolated database]")
				.replaceAll(env.CRM_BUSINESS_SCHEMA_NONCE, "[fixture nonce]");
			if (terminated || status !== 0) {
				rejectRun(
					new Error(`Business-schema assertions failed.\n${safeOutput}`),
				);
			} else {
				resolveRun(safeOutput.trim());
			}
		});
	});
}

async function assertListenerClosed(url) {
	await new Promise((resolveClosed, rejectClosed) => {
		const socket = createConnection({
			host: url.hostname,
			port: Number(url.port),
		});
		socket.setTimeout(1_000);
		socket.once("error", (error) => {
			socket.destroy();
			if (error.code === "ECONNREFUSED") resolveClosed();
			else
				rejectClosed(
					new Error("Cannot verify closure of the fixture listener."),
				);
		});
		socket.once("connect", () => {
			socket.destroy();
			rejectClosed(new Error("The fixture database port remains open."));
		});
		socket.once("timeout", () => {
			socket.destroy();
			rejectClosed(
				new Error("Fixture listener closure verification times out."),
			);
		});
	});
}

export async function verifyBusinessSchema() {
	if (process.env.CRM_BUSINESS_SCHEMA_TEST !== "1") {
		console.log(
			"SKIPPED: CRM_BUSINESS_SCHEMA_TEST=1 is required. No database starts.",
		);
		return true;
	}
	let database;
	let server;
	let url;
	let failed = false;
	try {
		if (process.env.DATABASE_URL || process.env.TEST_DATABASE_URL) {
			throw new Error(
				"Ambient database URLs are refused. Clear them before running this harness.",
			);
		}
		const { PGlite } = await import("@electric-sql/pglite");
		const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
		const migrations = (await readdir(migrationDirectory))
			.filter((name) => /^\d+_/.test(name))
			.sort();
		const first = migrations.indexOf(businessMigrations[0]);
		if (first < 0 || migrations[first + 1] !== businessMigrations[1]) {
			throw new Error(
				"The two business migrations must exist in the expected order.",
			);
		}
		database = await PGlite.create();
		for (const name of migrations.slice(0, first)) {
			await database.exec(
				await readFile(
					resolve(migrationDirectory, name, "migration.sql"),
					"utf8",
				),
			);
		}
		const nonce = randomUUID();
		await database.exec(
			"CREATE SCHEMA crm_business_schema_fixture; CREATE TABLE crm_business_schema_fixture.isolation (nonce TEXT PRIMARY KEY);",
		);
		await database.query(
			"INSERT INTO crm_business_schema_fixture.isolation (nonce) VALUES ($1)",
			[nonce],
		);
		server = new PGLiteSocketServer({
			db: database,
			host: "127.0.0.1",
			port: 0,
		});
		await server.start();
		url = validateBusinessSchemaUrl(
			`postgresql://postgres:postgres@${server.getServerConn()}/crm_business_schema_test`,
		);
		console.log(
			`Applied ${first} preceding SQL migrations to a disposable in-memory fixture.`,
		);
		for (const name of businessMigrations) {
			const sql = await readFile(
				resolve(migrationDirectory, name, "migration.sql"),
			);
			console.log(
				`${name} SHA256 ${createHash("sha256").update(sql).digest("hex")}`,
			);
		}
		console.log(
			"One loopback client seeds legacy rows before applying the two business migrations.",
		);
		console.log(await runTests(childEnvironment(url.toString(), nonce)));
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: "Business-schema verification failed.",
		);
		failed = true;
	} finally {
		try {
			await server?.stop();
		} catch {
			console.error("Cannot stop the fixture socket server.");
			failed = true;
		}
		try {
			await database?.close();
		} catch {
			console.error("Cannot close the in-memory fixture database.");
			failed = true;
		}
		if (url) {
			try {
				await assertListenerClosed(url);
				console.log(
					"Socket closure verified: ECONNREFUSED on the former loopback port.",
				);
			} catch (error) {
				console.error(
					error instanceof Error
						? error.message
						: "Fixture listener closure failed.",
				);
				failed = true;
			}
		}
		if (database && !failed) {
			console.log(
				"Disposed the in-memory fixture. PostgreSQL 17 and homelab remain unverified.",
			);
		}
	}
	return !failed;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const success = await verifyBusinessSchema();
	if (!success) process.exit(1);
}
