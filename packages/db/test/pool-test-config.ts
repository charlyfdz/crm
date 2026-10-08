export const POOL_RECOVERY_TEST = {
	connectionTimeoutMillis: 500,
	idleTimeoutMillis: 30_000,
	maxLifetimeSeconds: 600,
	keepAliveInitialDelayMillis: 1_000,
	eventTimeoutMillis: 3_000,
	eventPollMillis: 10,
	testTimeoutMillis: 15_000,
} as const;

export function isolatedPoolTestUrl(value: string | undefined): string {
	if (!value) {
		throw new Error(
			"Set an explicit TEST_DATABASE_URL for a new isolated database.",
		);
	}

	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error("TEST_DATABASE_URL must be a PostgreSQL URL.");
	}

	if (
		!["postgres:", "postgresql:"].includes(parsed.protocol) ||
		parsed.hostname !== "127.0.0.1" ||
		!/^\/[A-Za-z0-9_]+_test$/.test(parsed.pathname)
	) {
		throw new Error(
			"Pool integration tests require 127.0.0.1 and a database name ending in _test.",
		);
	}

	if (parsed.search || parsed.hash) {
		throw new Error(
			"Pool integration tests require a URL without query parameters or a fragment.",
		);
	}

	return value;
}
