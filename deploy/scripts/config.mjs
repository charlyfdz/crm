import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export const CONFIG = Object.freeze({
	operations: {
		manifestVersion: 1,
		maxCaptureBytes: 16 * 1024 * 1024,
		protectedDatabases: ["postgres", "template0", "template1"],
		nonWriters: ["postgres", "redis"],
	},
	cron: {
		baseUrl: "http://api:3001",
		heartbeatFile: "/tmp/crm-cron-health.json",
		heartbeatMs: 15000,
		staleMs: 90000,
		requestTimeoutMs: 70000,
		jobs: [
			{
				path: "/internal/sync/mailboxes",
				schedule: "*/5 * * * *",
				everyMinutes: 5,
			},
			{ path: "/internal/sync/rates", schedule: "0 6 * * *", hour: 6 },
			{ path: "/internal/tracking/retention", schedule: "0 4 * * *", hour: 4 },
			{ path: "/internal/archive/prune", schedule: "0 5 * * *", hour: 5 },
		],
	},
	probes: {
		api: { url: "http://127.0.0.1:3001/health", codes: [200] },
		app: { url: "http://127.0.0.1:3000/sign-in", codes: [200] },
		agent: {
			url: "http://127.0.0.1:2000/internal/crm/ai-status",
			codes: [200],
		},
		timeoutMs: 8000,
	},
});

export function dueJobs(date) {
	return CONFIG.cron.jobs.filter((job) =>
		job.everyMinutes
			? date.getUTCMinutes() % job.everyMinutes === 0
			: date.getUTCHours() === job.hour && date.getUTCMinutes() === 0,
	);
}
