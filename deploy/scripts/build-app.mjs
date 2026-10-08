import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

for (const key of ["API_URL", "APP_URL"]) {
	const value = process.env[key];
	if (!value) throw new Error(`${key} is required for the app build`);
	const url = new URL(value);
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password
	) {
		throw new Error(`${key} must be an HTTP origin without credentials`);
	}
}

const result = spawnSync("bun", ["run", "build"], {
	cwd: "apps/app",
	stdio: "inherit",
	env: {
		...process.env,
		NODE_ENV: "production",
		DATABASE_URL: "postgresql://localhost:5432/build",
		BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
		ALLOWED_SIGN_IN: "build.invalid",
		CRM_TELEMETRY_DISABLED: "1",
		NEXT_TELEMETRY_DISABLED: "1",
		DO_NOT_TRACK: "1",
		IS_MARKETING: "false",
	},
});
process.exit(result.status ?? 1);
