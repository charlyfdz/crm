# Deployment environment contract

Compose receives environment values from the installation owner. Never reuse values from the third-party CRM.
Keep one `.env` at the repository root for authorized local operations. Never add package-specific environment files.
Coolify stores production resource secrets separately. Do not export those secrets to this PC.

The principal owns `.env.example`, `turbo.json`, and API validation. This task does not edit those files.

## Required values

| Variable | Contract |
| --- | --- |
| `COMPOSE_PROJECT_NAME` | Unique installation name; record Coolify's actual project mapping before operations |
| `CRM_VERSION` | Frozen release identifier; never `latest`; record image digests separately |
| `POSTGRES_USER` | Safe database owner identifier; migration and database administration only |
| `POSTGRES_DB` | Safe installation database identifier; never a PostgreSQL system database |
| `POSTGRES_PASSWORD` | Separate generated owner secret; minimum 32 characters |
| `CRM_DB_USER` | Separate application role; no superuser, role creation, or database creation |
| `CRM_DB_PASSWORD` | Separate generated application secret; minimum 32 characters |
| `REDIS_PASSWORD` | Separate generated hexadecimal secret; minimum 32 characters |
| `BETTER_AUTH_SECRET` | Separate generated authentication secret; minimum 32 characters |
| `CRON_SECRET` | Separate generated cron secret; minimum 32 characters for this package |
| `ALLOWED_SIGN_IN` | Explicit approved addresses or domains; no public registration |
| `APP_URL` | Accepted private browser HTTPS origin; no credentials, path, query, or fragment |
| `API_URL` | Separate accepted private API HTTPS origin; reachable by browsers and application containers |
| `AUTH_COOKIE_DOMAIN` | Installation-specific parent domain covering both hosts when the hosts differ |
| `CRM_REDIS_MAXMEMORY` | Positive cache size; maximum 75 percent of the Redis container memory limit |

Generate secrets inside the approved password manager. Store each secret separately. Never put secrets in reports or shell arguments.

## Required measured resource values

Set both suffixes for every core and maintenance service:

```text
CRM_POSTGRES_MEMORY_LIMIT  CRM_POSTGRES_CPU_LIMIT
CRM_REDIS_MEMORY_LIMIT     CRM_REDIS_CPU_LIMIT
CRM_API_MEMORY_LIMIT       CRM_API_CPU_LIMIT
CRM_APP_MEMORY_LIMIT       CRM_APP_CPU_LIMIT
CRM_CRON_MEMORY_LIMIT      CRM_CRON_CPU_LIMIT
CRM_MIGRATE_MEMORY_LIMIT   CRM_MIGRATE_CPU_LIMIT
```

Memory uses positive integers with optional `b`, `k`, `m`, or `g`. CPU uses a positive decimal.
Zero, negative values, and missing values fail preflight. This package supplies no quota defaults.
Synthetic test limits do not represent production recommendations or capacity reservations.

## Build images

`CRM_NODE_IMAGE`, `CRM_BUN_IMAGE`, `CRM_POSTGRES_IMAGE`, and `CRM_REDIS_IMAGE` select the four base images.
Development defaults use Node 22, Bun 1.3.12, PostgreSQL 17, and Redis 7.4 on Debian.
Admission requires verified `@sha256:` image references. Record PostgreSQL 17 compatibility before accepting its digest.
Keep dependency installation frozen. Never pass runtime credentials as build arguments.

`API_URL` and `APP_URL` are the only public application build settings.
Next.js embeds `NEXT_PUBLIC_API_URL` during the build. An origin change requires a new application build.

## Optional AI overlay

AI needs all these settings together:

```text
CRM_AI_ENABLED=true
AGENT_URL=http://agent:2000
AGENT_BRIDGE_SECRET=<separate generated secret>
CRM_AGENT_MEMORY_LIMIT=<measured approved limit>
CRM_AGENT_CPU_LIMIT=<measured approved limit>
```

Load `deploy/compose.agent.yml` and activate its `agent` profile only after separate approval.
Preflight uses `--agent`. The flag alone does not enable AI or start a service.
The deployment owner also supplies the approved model credentials for the selected agent provider.
Context.dev remains an optional database setting. Never create `CONTEXT_DEV_API_KEY` as an environment variable.

Google, Microsoft, Slack, Blob, Perplexity, and GitHub credentials remain empty for the private manual pilot baseline.
Configure provider pairs together after separate acceptance. Never copy global administration credentials into the CRM.

## Runtime database connection

The runtime wrapper constructs a PostgreSQL URL for `postgres:5432` and encodes reserved password characters.
API and application processes receive the application database role, not the database owner.
The migration tool receives the owner role. It applies migrations, checks drift, and grants application permissions.
The wrapper removes raw PostgreSQL and Redis credential fields before it starts the application process.
Derived connection URLs remain process secrets. Do not log them.

The five `DATABASE_POOL_*` settings mirror the database client's documented settings and defaults.
They do not retry failed writes. See [PostgreSQL operations](../data/postgresql-operations.md).

## Preflight commands for a future authorized environment

```powershell
node --env-file=.env deploy/scripts/preflight.mjs
node --env-file=.env deploy/scripts/preflight.mjs --admission deploy/admission.pending.json
```

The pending admission record must fail. Do not change its pending declarations to manufacture approval.
`--local` accepts only the documented loopback HTTP origins for isolated local tests.
`--local` never combines with production admission. No preflight command installs or starts a service.

## Issues

1. NOT DONE — The principal must reconcile Compose variables with root environment documentation and Turbo passthrough.
   Fix: complete the integration listed in the principal handoff without placing secrets in cache keys.
2. UNKNOWN — Actual private origins and the container DNS path remain unverified.
   Fix: verify approved HTTPS origins from browsers and containers during authorized runtime acceptance.
