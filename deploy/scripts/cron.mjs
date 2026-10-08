import { renameSync, writeFileSync } from "node:fs";
import { CONFIG, dueJobs } from "./config.mjs";

const secret = process.env.CRON_SECRET;
if (!secret || secret.length < 16)
	throw new Error("CRON_SECRET needs 16 characters");

const state = { updatedAt: Date.now(), jobs: {} };
let stopping = false;
let request;
let lastMinute;

function heartbeat() {
	state.updatedAt = Date.now();
	writeFileSync(`${CONFIG.cron.heartbeatFile}.partial`, JSON.stringify(state), {
		mode: 0o600,
	});
	renameSync(`${CONFIG.cron.heartbeatFile}.partial`, CONFIG.cron.heartbeatFile);
}

async function tick() {
	const date = new Date();
	const minute = Math.floor(date.getTime() / 60000);
	if (minute === lastMinute) return;
	lastMinute = minute;
	for (const job of dueJobs(date)) {
		if (stopping) break;
		request = new AbortController();
		const timeout = setTimeout(
			() => request.abort(),
			CONFIG.cron.requestTimeoutMs,
		);
		try {
			const response = await fetch(`${CONFIG.cron.baseUrl}${job.path}`, {
				method: "POST",
				redirect: "error",
				headers: { authorization: `Bearer ${secret}` },
				signal: request.signal,
			});
			const outcome = await response.json();
			const ok = response.ok && outcome?.ok !== false;
			state.jobs[job.path] = { at: Date.now(), ok, status: response.status };
			process.stdout.write(
				`${JSON.stringify({ job: job.path, ok, status: response.status })}\n`,
			);
		} catch {
			state.jobs[job.path] = { at: Date.now(), ok: false };
			process.stderr.write(
				`${JSON.stringify({ job: job.path, error: "Request failed" })}\n`,
			);
		} finally {
			clearTimeout(timeout);
			request = undefined;
			heartbeat();
		}
	}
}

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.once(signal, () => {
		stopping = true;
		request?.abort();
		clearInterval(timer);
	});
}

heartbeat();
const timer = setInterval(heartbeat, CONFIG.cron.heartbeatMs);
while (!stopping) {
	await tick();
	if (!stopping) await new Promise((resolve) => setTimeout(resolve, 1000));
}
