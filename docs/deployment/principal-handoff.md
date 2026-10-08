# DevOps handoff

Date: 2026-10-02. Scope: local static deployment package only.
This task edits only `deploy/**`, `.dockerignore`, and `docs/deployment/**`.
It does not install software, run Docker, access SSH, modify Coolify, change Tailscale, or write to remote platforms.
It does not read credentials or environment files.

## Completed package changes

- Corrected the repository-root calculation in static validation and operations.
- Removed all host port publication and the application/API shared network namespace.
- Added separate application and API proxy target ports.
- Baked PostgreSQL and Redis startup scripts into image targets, without repository bind mounts.
- Required explicit measured CPU and memory limits for each core and maintenance service.
- Added shared-pool phase checks without claiming available capacity.
- Added current-capacity, full-version, recovery, lifecycle, and authorization admission declarations.
- Kept all admission gates pending in the pilot template.
- Separated the optional AI overlay from the manual baseline.
- Retained frozen dependency installation and copied the MIT license into image targets.
- Changed operation commands to plan-only defaults with explicit execution flags.
- Guarded restore installation, source release, checksum, database name, and writer quiescence.
- Added application grants after restored-schema verification without applying new migrations.
- Added unit tests for connection construction, schedules, limits, preflight, admission, recovery plans, and health probes.

## Principal-owned integration

Reconcile every Compose variable with root `.env.example` documentation.
Keep secrets empty in the example. Use Turbo passthrough, never secret cache keys, for variables used through Turbo tasks.
Declare API-consumed variables in API validation. Do not add deployment-only secrets to API validation without an API reader.

Check this deployment-specific variable set:

```text
COMPOSE_PROJECT_NAME
CRM_VERSION
POSTGRES_USER
POSTGRES_DB
POSTGRES_PASSWORD
CRM_DB_USER
CRM_DB_PASSWORD
REDIS_PASSWORD
CRM_NODE_IMAGE
CRM_BUN_IMAGE
CRM_POSTGRES_IMAGE
CRM_REDIS_IMAGE
CRM_REDIS_MAXMEMORY
CRM_{POSTGRES,REDIS,API,APP,CRON,MIGRATE,AGENT}_MEMORY_LIMIT
CRM_{POSTGRES,REDIS,API,APP,CRON,MIGRATE,AGENT}_CPU_LIMIT
```

Keep the existing authentication, cron, optional provider, AI policy, telemetry, and database-pool contracts aligned.
Read [Environment contract](environment-contract.md) for types, defaults, and secret rules.
Confirm the operator CLI works through the API image with interactive password entry.
Record the material local package change in the project and scoped knowledge context. Do not claim remote synchronization.

## Runtime acceptance outside this task

The complete product still needs its accepted release. This package does not declare the CRM complete.
Next.js standalone output generated on Windows does not prove a Linux container build.
Agent typechecks do not prove the optional agent container or provider integrations.

Required future validation includes container builds, fresh migrations, local login, persisted state, role boundaries, and database restart recovery.
Validate a restored application's business flows, not only database table counts.
Verify private DNS and TLS from both the browser and application container.
Validate the installed Coolify version, generated mappings, staged bootstrap, and persistent effective limits.
Measure shared capacity and operational headroom before assigning pilot quotas.

## Issues

1. NOT DONE — Root environment integration remains principal-owned.
   Fix: reconcile the listed variables without editing existing credentials.
2. NOT DONE — Linux container, restored-application, and installed Coolify acceptance remain outside this static task.
   Fix: obtain authorized runtime evidence after complete-version development; do not install Docker or deploy now.
3. UNKNOWN — The accepted private routing and container DNS design remain unconfirmed.
   Fix: finish the private HTTPS design and validate it before pilot admission.
4. NOT DONE — Backup automation, complete file recovery, and operational service lifecycle acceptance remain pending.
   Fix: finish those contracts before declaring operational production readiness.
