import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CONFIG } from "./config.mjs";

export async function healthy(
	target,
	{
		request = fetch,
		heartbeat = () =>
			JSON.parse(readFileSync(CONFIG.cron.heartbeatFile, "utf8")),
		now = Date.now(),
		bridgeSecret = process.env.AGENT_BRIDGE_SECRET ?? "",
	} = {},
) {
	try {
		if (target === "cron") {
			const state = heartbeat();
			if (
				!Number.isFinite(state.updatedAt) ||
				now < state.updatedAt ||
				now - state.updatedAt > CONFIG.cron.staleMs
			)
				return false;
			if (
				!state.jobs ||
				Object.values(state.jobs).some((job) => job.ok !== true)
			)
				return false;
		} else {
			const probe = CONFIG.probes[target];
			if (!probe) throw new Error("Unknown health target");
			const headers =
				target === "agent" ? { authorization: `Bearer ${bridgeSecret}` } : {};
			const response = await request(probe.url, {
				redirect: "manual",
				headers,
				signal: AbortSignal.timeout(CONFIG.probes.timeoutMs),
			});
			if (!probe.codes.includes(response.status)) return false;
			if (target === "api") {
				const result = await response.json();
				if (result.status !== "ok" || result.database !== "up") return false;
			} else {
				await response.body?.cancel();
			}
		}
		return true;
	} catch {
		return false;
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exitCode = (await healthy(process.argv[2])) ? 0 : 1;
}
