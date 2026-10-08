import { spawn } from "node:child_process";
import { constants } from "node:os";
import { pathToFileURL } from "node:url";

export function connectionEnvironment(source) {
	const env = { ...source };
	for (const key of ["POSTGRES_USER", "POSTGRES_DB", "POSTGRES_PASSWORD"]) {
		if (!env[key]) throw new Error(`${key} is required`);
	}
	if (env.POSTGRES_PASSWORD.length < 32)
		throw new Error("POSTGRES_PASSWORD needs 32 characters");
	const database = new URL("postgresql://postgres:5432");
	database.username = encodeURIComponent(env.POSTGRES_USER);
	database.password = encodeURIComponent(env.POSTGRES_PASSWORD);
	database.pathname = `/${encodeURIComponent(env.POSTGRES_DB)}`;
	database.searchParams.set("schema", "public");
	env.DATABASE_URL = database.href;
	if (env.REDIS_PASSWORD) {
		const redis = new URL("redis://redis:6379/0");
		redis.password = encodeURIComponent(env.REDIS_PASSWORD);
		env.REDIS_URL = redis.href;
	}
	for (const key of [
		"POSTGRES_USER",
		"POSTGRES_DB",
		"POSTGRES_PASSWORD",
		"REDIS_PASSWORD",
	])
		delete env[key];
	for (const [key, value] of Object.entries(env))
		if (value === "") delete env[key];
	return env;
}

export function run(command, args, env) {
	const child = spawn(command, args, { stdio: "inherit", env });
	for (const signal of ["SIGINT", "SIGTERM"])
		process.once(signal, () => child.kill(signal));
	child.once("error", () => {
		process.stderr.write("Runtime command cannot start\n");
		process.exitCode = 1;
	});
	child.once("exit", (code, signal) => {
		process.exitCode = code ?? 128 + (constants.signals[signal] ?? 1);
	});
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const [command, ...args] = process.argv.slice(2);
	if (!command) throw new Error("Runtime command is required");
	run(command, args, connectionEnvironment(process.env));
}
