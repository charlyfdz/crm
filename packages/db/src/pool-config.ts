export const DATABASE_POOL_DEFAULTS = {
	max: 10,
	min: 0,
	connectionTimeoutMillis: 10_000,
	idleTimeoutMillis: 30_000,
	maxLifetimeSeconds: 1_800,
	keepAlive: true,
	keepAliveInitialDelayMillis: 10_000,
	allowExitOnIdle: false,
} as const;

export const DATABASE_POOL_LIMITS = {
	maxConnections: 100,
	maxTimerMillis: 2_147_483_647,
	maxLifetimeSeconds: 2_147_483,
} as const;

export type DatabasePoolEnvironment = {
	readonly [name: string]: string | undefined;
	DATABASE_POOL_MAX?: string;
	DATABASE_POOL_CONNECTION_TIMEOUT_MS?: string;
	DATABASE_POOL_IDLE_TIMEOUT_MS?: string;
	DATABASE_POOL_MAX_LIFETIME_SECONDS?: string;
	DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS?: string;
};

function positiveInteger(
	env: DatabasePoolEnvironment,
	name: keyof DatabasePoolEnvironment,
	fallback: number,
	maximum: number,
): number {
	const value = env[name]?.trim();
	if (!value) return fallback;

	const parsed = Number(value);
	if (
		!/^\d+$/.test(value) ||
		!Number.isSafeInteger(parsed) ||
		parsed < 1 ||
		parsed > maximum
	) {
		throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
	}

	return parsed;
}

export function databasePoolConfig(env: DatabasePoolEnvironment) {
	return {
		...DATABASE_POOL_DEFAULTS,
		max: positiveInteger(
			env,
			"DATABASE_POOL_MAX",
			DATABASE_POOL_DEFAULTS.max,
			DATABASE_POOL_LIMITS.maxConnections,
		),
		connectionTimeoutMillis: positiveInteger(
			env,
			"DATABASE_POOL_CONNECTION_TIMEOUT_MS",
			DATABASE_POOL_DEFAULTS.connectionTimeoutMillis,
			DATABASE_POOL_LIMITS.maxTimerMillis,
		),
		idleTimeoutMillis: positiveInteger(
			env,
			"DATABASE_POOL_IDLE_TIMEOUT_MS",
			DATABASE_POOL_DEFAULTS.idleTimeoutMillis,
			DATABASE_POOL_LIMITS.maxTimerMillis,
		),
		maxLifetimeSeconds: positiveInteger(
			env,
			"DATABASE_POOL_MAX_LIFETIME_SECONDS",
			DATABASE_POOL_DEFAULTS.maxLifetimeSeconds,
			DATABASE_POOL_LIMITS.maxLifetimeSeconds,
		),
		keepAliveInitialDelayMillis: positiveInteger(
			env,
			"DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS",
			DATABASE_POOL_DEFAULTS.keepAliveInitialDelayMillis,
			DATABASE_POOL_LIMITS.maxTimerMillis,
		),
	};
}
