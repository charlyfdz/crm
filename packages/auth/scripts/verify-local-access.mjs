import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const databaseDirectory = resolve(workspace, "packages/db");
const authDirectory = resolve(workspace, "packages/auth");
const args = process.argv.slice(2);
if (
	args.length > 1 ||
	(args[0] &&
		![
			"--business-flow",
			"--deal-regressions",
			"--identity",
			"--record-access",
			"--record-regressions",
		].includes(args[0]))
)
	throw new Error(
		"Use no option, --business-flow, --deal-regressions, --identity, --record-access, or --record-regressions.",
	);
const businessFlow = args[0] === "--business-flow";
const dealRegressions = args[0] === "--deal-regressions";
const identity = args[0] === "--identity";
const recordAccess = args[0] === "--record-access";
const recordRegressions = args[0] === "--record-regressions";
const testDirectory =
	businessFlow ||
	dealRegressions ||
	identity ||
	recordAccess ||
	recordRegressions
		? resolve(workspace, "apps/api")
		: authDirectory;
const testFiles = recordAccess
	? ["test/local-record-access.integration.spec.ts"]
	: recordRegressions
		? ["test/bulk.spec.ts", "test/record-delete.spec.ts"]
		: dealRegressions
			? [
					"test/deal-contacts.spec.ts",
					"test/currency-totals.integration.spec.ts",
					"test/fields.spec.ts",
				]
			: identity
				? ["test/local-identity.integration.spec.ts"]
				: [
						businessFlow
							? "test/local-business-flow.integration.spec.ts"
							: "test/local-access.integration.spec.ts",
					];
const testDatabase = recordAccess
	? "crm_record_access_test"
	: recordRegressions
		? "crm_record_regression_test"
		: identity
			? "crm_identity_test"
			: dealRegressions
				? "crm_deal_regression_test"
				: businessFlow
					? "crm_business_flow_test"
					: "crm_access_test";
let server;
let database;
let databaseUrl;
let failed = false;

async function run(executable, args, cwd, env) {
	return new Promise((resolveRun, rejectRun) => {
		const child = spawn(executable, args, {
			cwd,
			env,
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		const timeout = setTimeout(() => child.kill(), 60_000);
		const collect = (chunk) => {
			output += chunk.toString();
			if (output.length > 4 * 1024 * 1024) child.kill();
		};
		child.stdout.on("data", collect);
		child.stderr.on("data", collect);
		child.on("error", () => {
			clearTimeout(timeout);
			rejectRun(new Error("Unable to start an isolated verification command."));
		});
		child.on("close", (status) => {
			clearTimeout(timeout);
			if (status !== 0) {
				const safeOutput = output
					.replaceAll(env.DATABASE_URL, "[isolated database]")
					.replaceAll(env.BETTER_AUTH_SECRET, "[test secret]");
				rejectRun(new Error(`Isolated verification failed.\n${safeOutput}`));
			} else resolveRun(output);
		});
	});
}

try {
	const { PGlite } = await import("@electric-sql/pglite");
	const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
	database = await PGlite.create();
	const migrationDirectory = resolve(databaseDirectory, "prisma/migrations");
	const migrations = (await readdir(migrationDirectory))
		.filter((name) => /^\d+_/.test(name))
		.sort();
	for (const name of migrations) {
		await database.exec(
			await readFile(
				resolve(migrationDirectory, name, "migration.sql"),
				"utf8",
			),
		);
	}
	server = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port: 0 });
	await server.start();
	const connection = new URL(
		`postgresql://postgres:postgres@${server.getServerConn()}/${testDatabase}`,
	);
	const url = connection.toString();
	databaseUrl = connection;
	if (
		!url ||
		!["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
	) {
		throw new Error("The isolated database is not loopback-only.");
	}
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
	const env = {
		...Object.fromEntries(
			Object.entries(process.env).filter(([key]) =>
				allowed.has(key.toLowerCase()),
			),
		),
		DATABASE_URL: url,
		TEST_DATABASE_URL: url,
		DATABASE_POOL_MAX: "1",
		BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
		ALLOWED_SIGN_IN: "example.test",
		API_URL: "http://127.0.0.1:3102",
		APP_URL: "http://127.0.0.1:3100",
		CRM_AI_ENABLED: "false",
		CRM_TELEMETRY_ENABLED: "false",
		CRM_TELEMETRY_DISABLED: "1",
		CRM_LOCAL_ACCESS_TEST:
			businessFlow ||
			dealRegressions ||
			identity ||
			recordAccess ||
			recordRegressions
				? "0"
				: "1",
		CRM_IDENTITY_TEST: identity ? "1" : "0",
		CRM_RECORD_ACCESS_TEST: recordAccess ? "1" : "0",
		CRM_RECORD_REGRESSION_TEST: recordRegressions ? "1" : "0",
		CRM_BUSINESS_FLOW_TEST: businessFlow ? "1" : "0",
		CRM_DEAL_REGRESSION_TEST: dealRegressions ? "1" : "0",
		NODE_ENV: "test",
		GOOGLE_CLIENT_ID: "",
		GOOGLE_CLIENT_SECRET: "",
		MICROSOFT_CLIENT_ID: "",
		MICROSOFT_CLIENT_SECRET: "",
		SLACK_CLIENT_ID: "",
		SLACK_CLIENT_SECRET: "",
	};
	console.log(
		"Disposable loopback database ready. SQL fixture applied from checked-in migrations.",
	);
	console.log(
		recordAccess
			? "Checking company/contact permissions with synthetic SQL and loopback HTTP. No external provider."
			: recordRegressions
				? "Checking company/contact regressions through services and synthetic SQL. No HTTP or external provider."
				: businessFlow || dealRegressions
					? "Checking configurable business flow through Prisma and actual services. No AI or external provider."
					: "Checking managed local access. Production migration deployment is a separate test.",
	);
	const output = await run(
		"bun",
		["--no-env-file", "--no-install", "test", ...testFiles],
		testDirectory,
		env,
	);
	const summary = output.match(
		/\d+ pass\s+\d+ fail[\s\S]*?Ran \d+ tests[^\n]*/,
	)?.[0];
	console.log(summary ?? "Local access assertions passed.");
} catch (error) {
	console.error(
		error instanceof Error
			? error.message
			: "Local access verification failed.",
	);
	failed = true;
} finally {
	await server?.stop();
	await database?.close();
	if (databaseUrl) {
		await new Promise((resolveClosed, rejectClosed) => {
			const socket = createConnection({
				host: databaseUrl.hostname,
				port: Number(databaseUrl.port),
			});
			socket.setTimeout(1_000);
			socket.once("error", (error) =>
				error.code === "ECONNREFUSED"
					? resolveClosed()
					: rejectClosed(
							new Error("Cannot verify disposal of the database listener."),
						),
			);
			socket.once("connect", () => {
				socket.destroy();
				rejectClosed(new Error("The disposable database port remains open."));
			});
			socket.once("timeout", () => {
				socket.destroy();
				rejectClosed(new Error("Database disposal verification times out."));
			});
		});
	}
	console.log(
		"Disposable database closed. No persistent instance or homelab change.",
	);
}
if (failed) process.exit(1);
