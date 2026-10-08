import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Db, PrismaLogRecord, PrismaLogSink } from "../src/client";
import { isolatedPoolTestUrl, POOL_RECOVERY_TEST } from "./pool-test-config";

const integration =
	process.env.DATABASE_POOL_TEST_ISOLATED === "1" ? describe : describe.skip;

integration(
	"Prisma pool recovery on a new isolated PostgreSQL database",
	() => {
		let database: Db | undefined;
		let control: import("pg").Client | undefined;
		let resetSink: ((next: PrismaLogSink | null) => void) | undefined;
		const records: PrismaLogRecord[] = [];
		const savedEnvironment = new Map<string, string | undefined>();

		function testDatabase(): Db {
			if (!database)
				throw new Error("The isolated Prisma client is not ready.");
			return database;
		}

		async function terminate(pid: number): Promise<void> {
			if (!control)
				throw new Error("The isolated control connection is not ready.");
			const result = await control.query<{ terminated: boolean }>(
				"SELECT pg_terminate_backend($1) AS terminated",
				[pid],
			);
			expect(result.rows[0]?.terminated).toBe(true);
		}

		async function waitForEvent(target: string, from: number): Promise<void> {
			const deadline = Date.now() + POOL_RECOVERY_TEST.eventTimeoutMillis;
			while (Date.now() < deadline) {
				if (records.slice(from).some((record) => record.target === target))
					return;
				await Bun.sleep(POOL_RECOVERY_TEST.eventPollMillis);
			}
			throw new Error(`No ${target} connection error event arrived.`);
		}

		beforeAll(async () => {
			const url = isolatedPoolTestUrl(process.env.TEST_DATABASE_URL);
			if (globalThis.prisma) {
				throw new Error("Run this integration file alone in a new process.");
			}

			const overrides = {
				NODE_ENV: "test",
				NEXT_RUNTIME: "nodejs",
				DATABASE_POOL_MAX: "1",
				DATABASE_POOL_CONNECTION_TIMEOUT_MS: String(
					POOL_RECOVERY_TEST.connectionTimeoutMillis,
				),
				DATABASE_POOL_IDLE_TIMEOUT_MS: String(
					POOL_RECOVERY_TEST.idleTimeoutMillis,
				),
				DATABASE_POOL_MAX_LIFETIME_SECONDS: String(
					POOL_RECOVERY_TEST.maxLifetimeSeconds,
				),
				DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS: String(
					POOL_RECOVERY_TEST.keepAliveInitialDelayMillis,
				),
			};
			for (const [name, value] of Object.entries(overrides)) {
				savedEnvironment.set(name, process.env[name]);
				process.env[name] = value;
			}

			const { Client } = await import("pg");
			control = new Client({
				connectionString: url,
				connectionTimeoutMillis: POOL_RECOVERY_TEST.connectionTimeoutMillis,
				application_name: "crm-pool-recovery-control",
			});
			await control.connect();
			const client = await import("../src/client");
			database = client.db;
			resetSink = client.setPrismaLogSink;
			resetSink((record) => records.push(record));
			await database.$connect();
		}, POOL_RECOVERY_TEST.testTimeoutMillis);

		afterAll(async () => {
			try {
				await database?.$disconnect();
			} finally {
				resetSink?.(null);
				await control?.end();
				if (database && globalThis.prisma === database) {
					globalThis.prisma = undefined;
				}
				for (const [name, value] of savedEnvironment) {
					if (value === undefined) delete process.env[name];
					else process.env[name] = value;
				}
			}
		});

		it(
			"logs idle backend termination and uses a new connection for the next request",
			async () => {
				const db = testDatabase();
				const [before] = await db.$queryRaw<{ pid: number }[]>`
			SELECT pg_backend_pid() AS pid
		`;
				if (!before) throw new Error("The test connection has no backend PID.");
				const from = records.length;
				await terminate(before.pid);
				await waitForEvent("pg.pool", from);
				const [after] = await db.$queryRaw<{ pid: number }[]>`
			SELECT pg_backend_pid() AS pid
		`;
				expect(after?.pid).not.toBe(before.pid);
				expect(after?.pid).toBeGreaterThan(0);
			},
			POOL_RECOVERY_TEST.testTimeoutMillis,
		);

		it(
			"rejects an interrupted transaction without replaying its writes",
			async () => {
				const db = testDatabase();
				let attempts = 0;
				const from = records.length;
				const transaction = db.$transaction(async (tx) => {
					attempts += 1;
					const [backend] = await tx.$queryRaw<{ pid: number }[]>`
				SELECT pg_backend_pid() AS pid
			`;
					if (!backend) throw new Error("The transaction has no backend PID.");
					await tx.$executeRaw`
				CREATE TEMP TABLE crm_pool_write_probe (value integer) ON COMMIT DROP
			`;
					await tx.$executeRaw`INSERT INTO crm_pool_write_probe (value) VALUES (1)`;
					await terminate(backend.pid);
					await tx.$queryRaw`SELECT 1`;
				});
				await expect(transaction).rejects.toThrow();
				expect(attempts).toBe(1);
				await waitForEvent("pg.connection", from);
				const rows = await db.$queryRaw<{ value: number }[]>`SELECT 1 AS value`;
				expect(rows[0]?.value).toBe(1);
			},
			POOL_RECOVERY_TEST.testTimeoutMillis,
		);

		it(
			"bounds the pool acquisition wait and recovers after the connection is released",
			async () => {
				const db = testDatabase();
				const acquired = Promise.withResolvers<void>();
				const release = Promise.withResolvers<void>();
				const held = db.$transaction(async (tx) => {
					await tx.$queryRaw`SELECT 1`;
					acquired.resolve();
					await release.promise;
				});
				try {
					await Promise.race([acquired.promise, held]);
					await expect(db.$queryRaw`SELECT 1`).rejects.toThrow();
				} finally {
					release.resolve();
					await held;
				}
				const rows = await db.$queryRaw<{ value: number }[]>`SELECT 1 AS value`;
				expect(rows[0]?.value).toBe(1);
			},
			POOL_RECOVERY_TEST.testTimeoutMillis,
		);

		it(
			"disconnects the adapter-owned pool at shutdown",
			async () => {
				const db = testDatabase();
				const [backend] = await db.$queryRaw<{ pid: number }[]>`
			SELECT pg_backend_pid() AS pid
		`;
				if (!backend || !control)
					throw new Error("The shutdown test is not ready.");
				await db.$disconnect();
				const result = await control.query<{ count: number }>(
					"SELECT count(*)::integer AS count FROM pg_stat_activity WHERE pid = $1",
					[backend.pid],
				);
				expect(result.rows[0]?.count).toBe(0);
			},
			POOL_RECOVERY_TEST.testTimeoutMillis,
		);
	},
);
