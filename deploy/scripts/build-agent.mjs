import { spawnSync } from "node:child_process";

const result = spawnSync("bun", ["run", "build"], {
	cwd: "apps/agent",
	stdio: "inherit",
	env: {
		...process.env,
		NODE_ENV: "production",
		DATABASE_URL: "postgresql://localhost:5432/build",
		CRM_TELEMETRY_DISABLED: "1",
		DO_NOT_TRACK: "1",
	},
});
process.exit(result.status ?? 1);
