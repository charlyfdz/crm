import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { CONFIG, repositoryRoot } from "./config.mjs";
import { migrationSteps } from "./migration-plan.mjs";

const cli = "node_modules/prisma/build/index.js";
const checkOnly = process.argv.includes("--check");
const grantOnly = process.argv.includes("--grant-only");
const role = process.env.CRM_DB_USER;
const database = decodeURIComponent(
	new URL(process.env.DATABASE_URL).pathname.slice(1),
);
if (CONFIG.operations.protectedDatabases.includes(database))
	throw new Error("Migration refuses system databases");
for (const step of migrationSteps({ role, database, checkOnly, grantOnly })) {
	const result = spawnSync("bun", [cli, ...step.args], {
		cwd: resolve(repositoryRoot, "packages/db"),
		stdio: step.input ? ["pipe", "inherit", "inherit"] : "inherit",
		input: step.input,
		env: process.env,
	});
	if (result.status !== 0) process.exit(result.status ?? 1);
}
