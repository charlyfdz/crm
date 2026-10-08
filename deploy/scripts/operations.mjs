import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	constants,
	copyFileSync,
	createReadStream,
	createWriteStream,
	existsSync,
	lstatSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { CONFIG, repositoryRoot } from "./config.mjs";
import {
	assertQuiescent,
	operationPlan,
	validateManifest,
} from "./operation-contract.mjs";
import { validateContract } from "./preflight.mjs";

const root = repositoryRoot;
const compose = [
	"compose",
	"--env-file",
	".env",
	"--project-name",
	process.env.COMPOSE_PROJECT_NAME,
	"-f",
	"deploy/compose.yml",
	...(process.env.CRM_AI_ENABLED === "true"
		? ["-f", "deploy/compose.agent.yml"]
		: []),
];

function capture(args, input) {
	const result = spawnSync("docker", [...compose, ...args], {
		cwd: root,
		encoding: "utf8",
		input,
		maxBuffer: CONFIG.operations.maxCaptureBytes,
	});
	if (result.status !== 0)
		throw new Error("Database operation fails. Check database logs locally.");
	return result.stdout.trim();
}

function execArgs(script, database) {
	if (database && !/^[a-z][a-z0-9_]{0,62}$/.test(database))
		throw new Error("Database identifier is unsafe");
	return [
		"exec",
		"-T",
		...(database ? ["-e", `CRM_TARGET_DB=${database}`] : []),
		"postgres",
		"sh",
		"-eu",
		"-c",
		`export PGPASSWORD="$POSTGRES_PASSWORD"; ${script}`,
	];
}

const countsSql =
	"SELECT format('SELECT %L || '':'' || count(*)::text FROM %I.%I;', schemaname || '.' || tablename, schemaname, tablename) FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename\n\\gexec\n";
function counts(database) {
	return capture(
		execArgs(
			`exec psql -X -qAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "\${CRM_TARGET_DB:-$POSTGRES_DB}"`,
			database,
		),
		countsSql,
	);
}

async function checksum(path) {
	if (!lstatSync(path).isFile())
		throw new Error("Archive must be a regular file, not a link");
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
}

async function streamCommand(args, input, output) {
	const child = spawn("docker", [...compose, ...args], {
		cwd: root,
		stdio: [input ? "pipe" : "ignore", output ? "pipe" : "ignore", "inherit"],
	});
	const completion = new Promise((resolveExit, reject) => {
		child.once("error", reject);
		child.once("exit", resolveExit);
	});
	completion.catch(() => {});
	try {
		if (input) await pipeline(input, child.stdin);
		if (output) await pipeline(child.stdout, output);
		if ((await completion) !== 0) throw new Error("Database stream fails");
	} catch {
		child.kill("SIGTERM");
		await completion.catch(() => {});
		throw new Error(
			"Database operation fails. Keep partial files and inspect local diagnostics",
		);
	}
}

async function executeOperation(plan) {
	const { command, archive, database } = plan;
	validateContract(process.env, process.env.CRM_AI_ENABLED === "true");
	assertQuiescent(
		capture(["ps", "--status", "running", "--services"])
			.split(/\r?\n/)
			.filter(Boolean),
	);

	if (command === "backup") {
		if (
			existsSync(archive) ||
			existsSync(`${archive}.json`) ||
			existsSync(`${archive}.partial`)
		) {
			throw new Error("Backup path already exists");
		}
		const rowCounts = counts();
		const images = JSON.parse(capture(["images", "--format", "json"]));
		await streamCommand(
			execArgs(
				'exec pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges',
			),
			undefined,
			createWriteStream(`${archive}.partial`, { flags: "wx", mode: 0o600 }),
		);
		copyFileSync(`${archive}.partial`, archive, constants.COPYFILE_EXCL);
		unlinkSync(`${archive}.partial`);
		const metadata = {
			formatVersion: CONFIG.operations.manifestVersion,
			installation: process.env.COMPOSE_PROJECT_NAME,
			release: process.env.CRM_VERSION,
			createdAt: new Date().toISOString(),
			sha256: await checksum(archive),
			rowCounts,
			images,
			revision: capture(["exec", "-T", "postgres", "postgres", "--version"]),
		};
		writeFileSync(`${archive}.json`, `${JSON.stringify(metadata, null, 2)}\n`, {
			flag: "wx",
			mode: 0o600,
		});
		process.stdout.write(
			"Backup and SHA-256 manifest complete. Run restore-drill next.\n",
		);
	} else {
		if (!lstatSync(`${archive}.json`).isFile())
			throw new Error("Manifest must be a regular file, not a link");
		const metadata = JSON.parse(readFileSync(`${archive}.json`, "utf8"));
		validateManifest(metadata, process.env, await checksum(archive));
		const receipt = `${archive}.${database}.verified.json`;
		if (existsSync(receipt))
			throw new Error("Verification receipt already exists");
		capture(
			execArgs(
				'exec createdb -h 127.0.0.1 -U "$POSTGRES_USER" --template=template0 --owner="$POSTGRES_USER" "$CRM_TARGET_DB"',
				database,
			),
		);
		await streamCommand(
			execArgs(
				'exec pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$CRM_TARGET_DB" --exit-on-error --single-transaction --no-owner --no-privileges',
				database,
			),
			createReadStream(archive),
			undefined,
		);
		if (counts(database) !== metadata.rowCounts)
			throw new Error("Restored table counts do not match the backup manifest");
		capture([
			"run",
			"--rm",
			"--no-deps",
			"-e",
			`POSTGRES_DB=${database}`,
			"migrate",
			"node",
			"/workspace/deploy/scripts/migrate.mjs",
			"--check",
		]);
		capture([
			"run",
			"--rm",
			"--no-deps",
			"-e",
			`POSTGRES_DB=${database}`,
			"migrate",
			"node",
			"/workspace/deploy/scripts/migrate.mjs",
			"--grant-only",
		]);
		const report = {
			verifiedAt: new Date().toISOString(),
			database,
			release: process.env.CRM_VERSION,
			sha256: metadata.sha256,
			rowCountsMatch: true,
			schemaMatch: true,
			grantsApplied: true,
			applicationSmokeTest: "pending",
			sourceUnchanged: true,
		};
		writeFileSync(receipt, `${JSON.stringify(report, null, 2)}\n`, {
			flag: "wx",
			mode: 0o600,
		});
		process.stdout.write(
			`Restore verifies in ${database}. Application smoke test remains required. Source data stays intact.\n`,
		);
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		const args = process.argv.slice(2).filter((arg) => arg !== "--execute");
		const plan = operationPlan(args[0], args[1], process.env, args[2]);
		if (process.argv.includes("--execute")) await executeOperation(plan);
		else
			process.stdout.write(
				`${JSON.stringify({ ...plan, executed: false }, null, 2)}\n`,
			);
	} catch (error) {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	}
}
