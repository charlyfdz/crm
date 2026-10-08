# PostgreSQL operations

## Installation contract

Each CRM installation serves one customer company and owns one PostgreSQL database.
The same software supports separate installations for other companies.
Each installation has separate database roles, secrets, backups, and restore targets.
This contract does not introduce SaaS tenancy.
The repository retains its MIT license and notices.

Use new credentials and synthetic records during development and acceptance tests.
Never copy an existing environment file or connect these tests to an existing database.
The database service stays on a private network.
External database connections require authenticated TLS and certificate verification.
Do not disable certificate verification to suppress connection errors.

## Connection ownership

`packages/db/src/client.ts` exports one Prisma client through module caching.
Development also stores that client in `globalThis.prisma` to survive module reloads.
Each process has its own pool. The app, API, agent, and replicas consume separate connection budgets.
The adapter owns its `pg` pool and closes it through Prisma `$disconnect()`.
Pool creation is lazy. `$connect()` alone does not prove a successful PostgreSQL query.
Use a bounded `SELECT 1` for database readiness.

Restart each consuming process after changing pool configuration or shared database code.
Do not create Prisma clients inside requests.
Do not disconnect after requests, connection errors, or successful queries.
Do not rebuild the complete client after an idle connection error.

## Configuration handoff to the principal

The following optional variables accept decimal positive integers.
An unset or blank value uses its default.
Invalid values stop client creation. Error messages exclude the supplied value.

| Variable | Default | Range | Effect |
| --- | ---: | ---: | --- |
| `DATABASE_POOL_MAX` | `10` | `1..100` | Maximum connections per process |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | `10000` | `1..2147483647` | Connection establishment and pool acquisition wait |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | `30000` | `1..2147483647` | Release unused connections |
| `DATABASE_POOL_MAX_LIFETIME_SECONDS` | `1800` | `1..2147483` | Rotate aged connections through pool lifecycle |
| `DATABASE_POOL_KEEPALIVE_INITIAL_DELAY_MS` | `10000` | `1..2147483647` | Initial TCP keepalive delay |

The pool also sets `min: 0`, `keepAlive: true`, and `allowExitOnIdle: false`.
These values target a persistent server process.
The pool does not preallocate connections.
Connection rotation does not cancel an active transaction. The pool removes expired connections when they return.
TCP keepalive detects broken sockets through operating system behavior. It does not prove server availability.
The connection timeout does not bound query duration or transaction duration.
Define statement and transaction budgets separately after measuring the application workload.

The principal integrates these variables into `.env.example`, root Turbo pass-through, and API environment validation.
All processes that import `@crm/db` need the same documented parsing rules.
Use the exact names and ranges above. Preserve blank-value defaults in validation.
No dependency installation is part of this DBA change.
The client uses the existing `@prisma/adapter-pg` dependency and its internal `pg` pool.

`DATABASE_POOL_TEST_ISOLATED=1` enables the destructive connection tests described below.
It stays unset during ordinary tests and operation.
The flag attests that the principal supplies a new disposable PostgreSQL cluster.
`TEST_DATABASE_URL` supplies the explicit synthetic target. There is no fallback to `DATABASE_URL`.

## Capacity and limits

Calculate the total pool budget before starting all services:

```text
sum(process_count_for_each_service * pool_max_for_that_service)
+ migration_connections + backup_connections + monitoring_connections
<= PostgreSQL max_connections - reserved_connections - operator_headroom
```

For example, one app, API, and agent with default pools need up to 30 application connections.
Two complete replicas need up to 60 application connections, before maintenance and operator headroom.
Include rolling-update overlap in this calculation.
Reserve at least ten ordinary connection slots for maintenance in an initial small installation.
Keep PostgreSQL administrator reservations separate from that headroom.
Measure queue wait, request latency, PostgreSQL sessions, and memory before increasing pool size.
Increasing `max_connections` consumes database resources. It does not correct slow queries or leaked transactions.

The configured pool waits for a free connection until its acquisition timeout expires.
This timeout limits waiting time. It does not limit queued request count.
The API still needs request concurrency limits under overload.
Monitor `pg_stat_activity` by database and application process through approved operational tooling.
This change does not export pool counters or install monitoring services.

Use a dedicated runtime role with required application permissions.
Use a separate migration role for schema changes and a separate backup role with complete read access.
Keep roles scoped to their installation database.
Do not grant application runtime roles superuser privileges or unrestricted database creation.
Define role creation, migration ownership, and grants in the installation workflow before production acceptance.

## Connection failure behavior

The adapter installs its own idle pool error listener.
`onPoolError` forwards idle failures to the existing Prisma logging sink with target `pg.pool`.
`onConnectionError` forwards checked-out transaction connection failures with target `pg.connection`.
Ordinary query errors continue through Prisma's error event and the returned operation error.
The record contains a fixed message and a validated driver code, or `UNKNOWN`.
It excludes error messages, SQL, URL, credentials, detail fields, and stacks.
The existing API logging bridge consumes the same record shape.
The callback falls back to the console sink when the configured sink throws.

`pg` removes a failed idle connection from its pool.
Later requests acquire healthy connections or create new connections after PostgreSQL becomes available.
A request that races with connection loss still receives its error.
This change adds no query retry and no transaction retry.
The pool does not replay writes or reconstruct interrupted transactions.
An error during commit leaves the commit outcome uncertain until application reconciliation establishes the result.
Application retries require operation-specific idempotency and a known outcome.

Keep `PRISMA_LOG_QUERIES` unset outside controlled diagnosis.
Existing Prisma query and operation error logging remains separate from these sanitized connection records.
This change does not claim that every pre-existing Prisma log excludes business data.
Review that logging before introducing real records.

## Reported connection error audit

The reported message is `Server has closed the connection`.
No supplied PostgreSQL log, timestamp correlation, backend PID, or reproduction establishes its cause.
Do not classify it as pool exhaustion, an idle server timeout, or a PostgreSQL crash without evidence.

The previous client supplies only a connection string to the adapter.
It relies on implicit driver pool defaults and has no configured idle error callback.
The adapter already installs a pool listener. A missing application callback does not establish an uncaught error.
The new settings bound connection waits and add connection error visibility.
They do not establish a fix for the historical error's unknown cause.

Collect the following evidence during an isolated reproduction:

1. Record UTC time, process identity, request correlation, driver code, and affected backend PID.
2. Correlate PostgreSQL shutdown, restart, timeout, authentication, and resource logs at the same time.
3. Inspect `max_connections`, active sessions, reserved slots, and application process counts.
4. Inspect server idle timeouts and any proxy or firewall connection lifetime.
5. Record Prisma, adapter, `pg`, runtime, and PostgreSQL versions.
6. Distinguish an idle failure from a failure inside a query or transaction.
7. Record a successful independent query after recovery through the same Prisma client.

Store safe summaries in project evidence. Exclude credentials, raw private logs, and connection URLs.

## Shutdown requirements

The API `DatabaseModule` already implements `onApplicationShutdown()` and calls `$disconnect()`.
Its signal-hook activation and request-drain order require integration verification by the principal.
The app and agent require their own verified shutdown paths.

1. Mark the process unready and stop accepting new requests or jobs.
2. Drain accepted operations within the service shutdown budget.
3. Await the shared client's `$disconnect()` once during normal shutdown.
4. Confirm PostgreSQL no longer lists that process's sessions.
5. Exit after cleanup. A supervisor enforces the outer shutdown deadline.

Do not call `pool.end()` separately for this adapter-owned pool.
Do not register competing process signal handlers in a shared database package.
Long-running transactions require explicit drain handling. Connection establishment timeout does not bound shutdown.

## Backup and restoration requirements

The installation owner defines recovery point objective, recovery time objective, retention, and backup access.
Schedule logical backups for the company database using PostgreSQL `pg_dump` custom format.
Use a compatible client version. Test restores into the supported PostgreSQL server version.
Run backups outside schema migration windows.
The backup role must read every required application table, sequence, and large object.
Detect omitted objects and failed commands. A successful file creation alone is insufficient evidence.

Store backups outside the live database volume, with encryption, access control, and integrity hashes.
Keep encryption keys recoverable through the approved secret-management procedure.
Back up role definitions and grants separately through restricted administrator tooling.
`pg_dump` covers one database. It does not capture cluster roles.
Include `_prisma_migrations` in the database backup.
Back up referenced file storage and required installation secrets separately under the same recovery contract.
Document file consistency and secret recovery without copying their contents into project evidence.

Restore into a new empty database created from `template0`.
Recreate the installation roles and restore with explicit owner and grant handling.
Use `pg_restore --exit-on-error`; use `--single-transaction` for a restore size that supports it.
Do not combine single-transaction restore with parallel restore jobs.
Never use `--clean` against an existing company database during a restoration test.
Use the application version matching the backup before planning an upgrade.
Review migration history and schema agreement before applying later migrations.
Run `ANALYZE`, compare synthetic record counts and checksums, and test application reads and permissions.
Measure restoration time and demonstrate the configured recovery objectives.
Keep a receipt with date, versions, backup hash, target identity, checks, duration, and failures.
Do not treat a logical dump as point-in-time recovery. Define WAL archiving separately when the recovery objective requires it.

## Guarded integration test

The principal installs dependencies and generates Prisma once through the approved isolated workflow.
Generation does not require a database connection. The principal controls Prisma configuration and environment loading.
The principal provides a new disposable PostgreSQL cluster, a new synthetic role, and an empty database ending in `_test`.
Bind the cluster to `127.0.0.1` on an unused port. Use a new volume or data directory.
Do not reuse the repository Compose deployment, existing test databases, or existing environment files.
The connection role requires permission to terminate its own sessions for this test.
No application migration or seed is necessary. The transaction test uses only a temporary synthetic table.

Run pure tests from the repository root:

```powershell
bun test --no-env-file packages/db/test/pool-config.spec.ts packages/db/test/pool-errors.spec.ts packages/db/test/pool-test-guard.spec.ts
```

Set `TEST_DATABASE_URL` directly in the process environment from the new cluster setup.
Do not print the URL or store it in an environment file.
Set the isolation flag and run only the integration file in a fresh process:

```powershell
$env:DATABASE_POOL_TEST_ISOLATED = '1'
bun test --no-env-file packages/db/test/pool-recovery.integration.spec.ts
Remove-Item Env:DATABASE_POOL_TEST_ISOLATED
```

The guard rejects remote hosts, non-PostgreSQL URLs, live database names, query overrides, and fragments.
It accepts only `127.0.0.1` and a database name ending in `_test`.
The isolation flag is an operator attestation. The suffix alone does not prove a disposable cluster.
The test sets `NODE_ENV=test` and `NEXT_RUNTIME=nodejs` before importing the client.
The first setting selects only `TEST_DATABASE_URL`. The second prevents the root environment loader from reading files.
Bun's `--no-env-file` also disables Bun's automatic environment-file loading.

The integration test checks four behaviors:

1. Terminate one idle application backend; capture `pg.pool`; query through the same client with a new backend PID.
2. Interrupt a transaction after synthetic temporary writes; capture `pg.connection`; assert one transaction attempt and subsequent query success.
3. Hold the single pool connection; assert acquisition failure within the test deadline; release it and query successfully.
4. Disconnect the adapter-owned pool; confirm its backend disappears from `pg_stat_activity`.

Termination affects only the backend PID returned by the test's application connection.
The control connection uses the same disposable database.
Ordinary runs skip all four tests without the explicit isolation flag.
The tests do not prove complete cluster restart recovery. Perform the following separate drill.

## Complete outage and recovery drill

The principal owns the new disposable cluster and its start/stop commands.
Record its exact identity before stopping it. Stop only that cluster and keep the test process running.
Use the same guarded target and process settings as the integration test.
Open `bun --no-env-file repl` from the repository root after setting `NODE_ENV=test` and `NEXT_RUNTIME=nodejs`.
Import the client once:

```typescript
const { db, setPrismaLogSink } = await import("./packages/db/src/client.ts");
setPrismaLogSink((record) => console.error(JSON.stringify(record)));
await db.$queryRaw`SELECT pg_backend_pid() AS pid`;
```

1. Stop the disposable cluster while the application connection is idle.
2. Confirm a sanitized `pg.pool` record and a live application process.
3. Submit one independent `SELECT 1` while the cluster is down. Record its failure and elapsed time.
4. Restart that same cluster and wait for its PostgreSQL readiness check.
5. Submit a new `SELECT 1` through the original `db`. Record successful completion and its backend PID.
6. Repeat the outage during a synthetic transaction. Record transaction rejection without replaying its writes.
7. Await `db.$disconnect()` and remove only the disposable cluster resources through the principal's approved workflow.

Manual recovery probes are independent reads. They do not retry a failed business operation.
Record logs and timing without URLs or credentials.
An unobserved error event or a failed post-restart query fails the drill and requires further diagnosis.

## Evidence and open work

This DBA change stays within `packages/db/src/client.ts`, new pool modules, focused tests, and `docs/data`.
The local knowledge check reports stale remote snapshots. They do not establish runtime availability.
The current user instruction defines the installation contract above.
The principal owns portfolio evidence and knowledge-engine updates because those files exceed this specialist's write scope.
The principal also owns environment integration, service lifecycle hooks, and isolated PostgreSQL provisioning.

The pure configuration and diagnostic tests run without Prisma, PostgreSQL, or environment-file access.
Runtime integration, the complete outage drill, and restoration acceptance require separate execution receipts.
Do not claim historical root cause, PostgreSQL recovery, or restoration acceptance from pure tests.

### DBA verification receipt, 2026-10-01

- Bun `1.4.2` runs 17 pure tests successfully, with 202 assertions.
- The four PostgreSQL integration tests and their setup/cleanup hooks remain skipped without the isolation flag.
- TypeScript `5.9.2` verifies `packages/db/tsconfig.json` without errors.
- The installed adapter is `@prisma/adapter-pg` `7.9.1`; the installed driver is `pg` `8.22.0`.
- Installed adapter source confirms idle and transaction callbacks, internal pool ownership, and disposal through `client.end()`.
- The focal Biome check verifies the eight changed TypeScript files.
- No disposable PostgreSQL target is supplied to this specialist. Runtime and complete outage checks remain unexecuted.
- No backup or restoration command runs during this change.

Commands use `--no-env-file`. The specialist does not access existing databases or environment files.
The installed Bun differs from the repository's declared `1.3.12` runtime.
The principal repeats acceptance tests with the distribution runtime before recording release acceptance.

## Sources

- [node-postgres pool lifecycle and errors](https://node-postgres.com/apis/pool)
- [Prisma persistent client management](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)
- [Prisma pool adapter options and disposal source](https://github.com/prisma/prisma/blob/7.0.0/packages/adapter-pg/src/pg.ts)
- [PostgreSQL logical backup and restoration](https://www.postgresql.org/docs/current/backup-dump.html)

The source link documents the callback contract in version 7.0.0.
Local inspection also verifies that contract in installed version 7.9.1.
Database execution still requires the separate integration receipt.
