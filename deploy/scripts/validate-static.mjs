import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONFIG, repositoryRoot } from "./config.mjs";

const root = repositoryRoot;
const read = (path) => readFileSync(resolve(root, path), "utf8");
const yaml = Bun.YAML.parse(read("deploy/compose.yml"));
const overlay = Bun.YAML.parse(read("deploy/compose.agent.yml"));
const dockerfile = read("deploy/Dockerfile");
const manifest = JSON.parse(read("package.json"));
assert.match(manifest.packageManager, /^bun@1\.3\.12$/);
assert.ok(existsSync(resolve(root, "bun.lock")));
assert.match(dockerfile, /bun install --frozen-lockfile --ignore-scripts/);
assert.match(dockerfile, /COPY LICENSE/);
assert.match(read("LICENSE"), /MIT License/);
assert.match(read(".dockerignore"), /\*\*\/\.env/);
assert.match(
	read(".dockerignore"),
	/!packages\/db\/prisma\/migrations\/\*\*\/\*\.sql/,
);
assert.match(read("apps/app/next.config.ts"), /output: "standalone"/);
assert.match(read("apps/api/package.json"), /dist\/main\.js/);
assert.equal(yaml.networks.data.internal, true);
assert.equal(yaml.services.agent, undefined);
assert.deepEqual(overlay.services.agent.profiles, ["agent"]);
assert.equal(overlay.services.agent.ports, undefined);
assert.equal(yaml.services.app.network_mode, undefined);
assert.deepEqual(yaml.services.app.networks, ["data", "application"]);
assert.deepEqual(yaml.services.app.expose, ["3000"]);
assert.deepEqual(yaml.services.api.expose, ["3001"]);
assert.deepEqual(yaml.services.migrate.profiles, ["tools"]);
assert.equal(yaml.services.migrate.restart, "no");
assert.match(
	yaml.services.api.environment.POSTGRES_PASSWORD,
	/CRM_DB_PASSWORD/,
);
assert.match(
	yaml.services.migrate.environment.POSTGRES_PASSWORD,
	/POSTGRES_PASSWORD/,
);
assert.equal(yaml.services.api.environment.CRM_TELEMETRY_ENABLED, "false");
assert.equal(
	yaml.services.api.environment.CRM_AI_ENABLED,
	`\${CRM_AI_ENABLED:-false}`,
);
assert.match(dockerfile, /FROM \$\{POSTGRES_IMAGE\} AS postgres/);
assert.match(dockerfile, /FROM \$\{REDIS_IMAGE\} AS redis/);
assert.match(read(".dockerignore"), /\*\*\/\.local/);
for (const [name, service] of Object.entries({
	...yaml.services,
	...overlay.services,
})) {
	assert.equal(service.ports, undefined, `${name} must not publish host ports`);
	assert.equal(
		service.container_name,
		undefined,
		`${name} must not use a shared global container name`,
	);
	assert.match(service.mem_limit, /MEMORY_LIMIT:\?/);
	assert.match(service.cpus, /CPU_LIMIT:\?/);
	assert.deepEqual(service.logging, {
		driver: "json-file",
		options: { "max-size": "10m", "max-file": "3" },
	});
	if (name !== "migrate")
		assert.ok(service.healthcheck, `${name} requires a healthcheck`);
	if (service.build)
		assert.match(dockerfile, new RegExp(` AS ${service.build.target}\\n`));
	for (const volume of service.volumes ?? []) {
		assert.ok(
			!volume.startsWith("./"),
			`${name} uses image-owned scripts, not repository bind mounts`,
		);
	}
}
const apiSchedule = JSON.parse(read("apps/api/vercel.json")).crons;
assert.deepEqual(
	CONFIG.cron.jobs
		.map(({ path, schedule }) => ({ path, schedule }))
		.sort((a, b) => a.path.localeCompare(b.path)),
	apiSchedule
		.filter((job) => !job.path.includes("telemetry"))
		.sort((a, b) => a.path.localeCompare(b.path)),
);
for (const path of [
	"config.mjs",
	"health.mjs",
	"runtime.mjs",
	"migrate.mjs",
	"cron.mjs",
]) {
	assert.ok(existsSync(resolve(root, "deploy/scripts", path)));
}
for (const path of [
	"deploy/scripts/init-postgres.sh",
	"deploy/scripts/redis.sh",
]) {
	assert.ok(!read(path).includes("\r"), `${path} requires POSIX line endings`);
}
const pending = JSON.parse(read("deploy/admission.pending.json"));
assert.equal(pending.deploymentAuthorized, false);
assert.ok(
	Object.values(pending.checks).every((status) => status === "pending"),
);
process.stdout.write(
	"Static deployment contracts pass. Docker build and runtime remain unverified.\n",
);
