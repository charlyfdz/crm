import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateAdmission } from "./admission.mjs";
import { validateResources } from "./resources.mjs";

export function validateContract(env, agent = false, local = false) {
	for (const key of [
		"COMPOSE_PROJECT_NAME",
		"CRM_VERSION",
		"POSTGRES_USER",
		"POSTGRES_DB",
		"POSTGRES_PASSWORD",
		"CRM_DB_USER",
		"CRM_DB_PASSWORD",
		"REDIS_PASSWORD",
		"BETTER_AUTH_SECRET",
		"CRON_SECRET",
		"ALLOWED_SIGN_IN",
		"APP_URL",
		"API_URL",
	]) {
		if (!env[key]?.trim()) throw new Error(`${key} is required`);
	}
	for (const key of [
		"POSTGRES_PASSWORD",
		"CRM_DB_PASSWORD",
		"REDIS_PASSWORD",
		"BETTER_AUTH_SECRET",
		"CRON_SECRET",
	]) {
		if (env[key].length < 32)
			throw new Error(`${key} needs at least 32 characters`);
	}
	if (
		new Set([
			env.POSTGRES_PASSWORD,
			env.CRM_DB_PASSWORD,
			env.REDIS_PASSWORD,
			env.BETTER_AUTH_SECRET,
			env.CRON_SECRET,
		]).size !== 5
	) {
		throw new Error("Generate a separate value for each secret");
	}
	if (!/^[a-fA-F0-9]{32,}$/.test(env.REDIS_PASSWORD))
		throw new Error("REDIS_PASSWORD must use hexadecimal characters");
	for (const key of ["POSTGRES_USER", "POSTGRES_DB", "CRM_DB_USER"]) {
		if (!/^[a-z][a-z0-9_]{0,62}$/.test(env[key]))
			throw new Error(`${key} needs a safe PostgreSQL identifier`);
	}
	if (
		env.POSTGRES_USER === env.CRM_DB_USER ||
		env.CRM_DB_USER.startsWith("pg_")
	) {
		throw new Error("Use a separate non-reserved application database role");
	}
	if (!/^[a-z0-9][a-z0-9_-]*$/.test(env.COMPOSE_PROJECT_NAME))
		throw new Error("Use a valid Compose installation name");
	if (
		!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(env.CRM_VERSION) ||
		env.CRM_VERSION === "latest"
	) {
		throw new Error("CRM_VERSION needs an immutable release identifier");
	}
	for (const key of ["APP_URL", "API_URL"]) {
		const url = new URL(env[key]);
		if (
			url.username ||
			url.password ||
			url.pathname !== "/" ||
			url.search ||
			url.hash
		)
			throw new Error(`${key} must be an origin without credentials`);
		const loopback = url.hostname === "127.0.0.1";
		const expectedPort = key === "APP_URL" ? "3000" : "3001";
		if (
			url.protocol !== "https:" &&
			!(
				local &&
				url.protocol === "http:" &&
				loopback &&
				url.port === expectedPort
			)
		) {
			throw new Error(
				`${key} needs HTTPS or its documented loopback test origin`,
			);
		}
	}
	const app = new URL(env.APP_URL);
	const api = new URL(env.API_URL);
	if (app.origin === api.origin)
		throw new Error(
			"Application and API need separate origins in this package",
		);
	const domain = env.AUTH_COOKIE_DOMAIN?.replace(/^\./, "");
	if (app.hostname !== api.hostname) {
		if (!domain) {
			throw new Error(
				"AUTH_COOKIE_DOMAIN must cover both application and API hosts",
			);
		}
	}
	if (domain) {
		if (
			!/^[a-z0-9.-]+$/.test(domain) ||
			![app, api].every(
				(url) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
			)
		) {
			throw new Error(
				"AUTH_COOKIE_DOMAIN must cover both application and API hosts",
			);
		}
		if (
			!domain.includes(".") ||
			["ts.net", "com", "net", "org"].includes(domain)
		) {
			throw new Error(
				"AUTH_COOKIE_DOMAIN needs an installation-specific parent domain",
			);
		}
	}
	if (env.CRM_AI_ENABLED && !["true", "false"].includes(env.CRM_AI_ENABLED))
		throw new Error("CRM_AI_ENABLED needs true or false");
	for (const provider of ["GOOGLE", "MICROSOFT", "SLACK"]) {
		if (
			Boolean(env[`${provider}_CLIENT_ID`]) !==
			Boolean(env[`${provider}_CLIENT_SECRET`])
		) {
			throw new Error(`${provider} OAuth credentials must be paired`);
		}
	}
	if (agent) {
		if (
			env.AGENT_URL !== "http://agent:2000" ||
			(env.AGENT_BRIDGE_SECRET?.length ?? 0) < 32
		) {
			throw new Error(
				"Agent profile needs http://agent:2000 and a new bridge secret",
			);
		}
		if (env.CRM_AI_ENABLED !== "true")
			throw new Error("Agent profile needs explicit CRM_AI_ENABLED=true");
		if (
			[
				env.POSTGRES_PASSWORD,
				env.CRM_DB_PASSWORD,
				env.REDIS_PASSWORD,
				env.BETTER_AUTH_SECRET,
				env.CRON_SECRET,
			].includes(env.AGENT_BRIDGE_SECRET)
		) {
			throw new Error("Generate a separate agent bridge secret");
		}
	} else if (
		env.AGENT_URL ||
		env.AGENT_BRIDGE_SECRET ||
		env.CRM_AI_ENABLED === "true"
	) {
		throw new Error(
			"Agent settings need the agent profile and the --agent preflight flag",
		);
	}
	validateResources(env, agent);
	return true;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		validateContract(
			process.env,
			process.argv.includes("--agent"),
			process.argv.includes("--local"),
		);
		const admissionIndex = process.argv.indexOf("--admission");
		if (admissionIndex >= 0) {
			const path = process.argv[admissionIndex + 1];
			if (!path || path.startsWith("--"))
				throw new Error("--admission needs a JSON record path");
			if (process.argv.includes("--local"))
				throw new Error("Local fixtures never authorize production admission");
			validateAdmission(
				JSON.parse(readFileSync(path, "utf8")),
				process.env,
				process.argv.includes("--agent"),
			);
			process.stdout.write(
				"Admission declarations pass. Confirm source evidence and human authorization before deployment. No service starts.\n",
			);
		}
		process.stdout.write(
			"Configuration passes. Capacity, release acceptance, and deployment permission remain separate gates. No service starts.\n",
		);
	} catch (error) {
		process.stderr.write(`Preflight fails: ${error.message}\n`);
		process.exitCode = 1;
	}
}
