import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG } from "./config.mjs";
import { healthy } from "./health.mjs";

test("API health requires HTTP success and a ready database", async () => {
	assert.equal(
		await healthy("api", {
			request: async () => Response.json({ status: "ok", database: "up" }),
		}),
		true,
	);
	assert.equal(
		await healthy("api", {
			request: async () => Response.json({ status: "ok", database: "down" }),
		}),
		false,
	);
	assert.equal(
		await healthy("api", {
			request: async () => new Response("failure", { status: 503 }),
		}),
		false,
	);
});

test("health probes reject redirects, network errors, invalid JSON, and unknown targets", async () => {
	assert.equal(
		await healthy("app", {
			request: async () => new Response(null, { status: 302 }),
		}),
		false,
	);
	assert.equal(
		await healthy("api", { request: async () => new Response("not-json") }),
		false,
	);
	assert.equal(
		await healthy("app", {
			request: async () => {
				throw new Error("synthetic network failure");
			},
		}),
		false,
	);
	assert.equal(await healthy("unknown"), false);
});

test("agent health uses a server-only bridge token", async () => {
	assert.equal(
		await healthy("agent", {
			bridgeSecret: "fixture-only",
			request: async (url, options) => {
				assert.equal(url, CONFIG.probes.agent.url);
				assert.equal(options.headers.authorization, "Bearer fixture-only");
				assert.equal(options.redirect, "manual");
				return Response.json({ enabled: true });
			},
		}),
		true,
	);
});

test("cron health rejects stale, failed, missing, and future heartbeat records", async () => {
	const now = 20261002;
	assert.equal(
		await healthy("cron", {
			now,
			heartbeat: () => ({ updatedAt: now, jobs: {} }),
		}),
		true,
	);
	assert.equal(
		await healthy("cron", {
			now,
			heartbeat: () => ({ updatedAt: now, jobs: { fixture: { ok: true } } }),
		}),
		true,
	);
	assert.equal(
		await healthy("cron", {
			now,
			heartbeat: () => ({ updatedAt: now, jobs: { fixture: { ok: false } } }),
		}),
		false,
	);
	assert.equal(
		await healthy("cron", {
			now,
			heartbeat: () => ({ updatedAt: now - CONFIG.cron.staleMs - 1, jobs: {} }),
		}),
		false,
	);
	assert.equal(
		await healthy("cron", {
			now,
			heartbeat: () => ({ updatedAt: now + 1, jobs: {} }),
		}),
		false,
	);
	assert.equal(
		await healthy("cron", { now, heartbeat: () => ({ updatedAt: now }) }),
		false,
	);
	assert.equal(
		await healthy("cron", {
			now,
			heartbeat: () => {
				throw new Error("missing fixture");
			},
		}),
		false,
	);
});
