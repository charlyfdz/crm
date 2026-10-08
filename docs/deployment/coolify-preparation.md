# Coolify preparation: do not execute now

This document prepares a future installation. The current task does not create or modify a Coolify resource.
The complete CRM release and its admission record come first.

## Resource design

Use one private Coolify application for the Corporativo S&F installation.
The approved server placement is the homelab `paas-control` VM. Do not infer a new server or public domain.
Use a Git-backed Docker Compose application after the owner approves a private source repository.
This checkout has no published repository or deployment integration from this task.

Proposed configuration:

| Field | Prepared value |
| --- | --- |
| Build pack | Docker Compose |
| Base directory | Repository root |
| Compose location | `deploy/compose.yml` |
| Raw Compose deployment | Off; retain managed proxy and resource configuration |
| Inject build arguments | Off; the Dockerfile declares its required arguments |
| Application HTTP target | Service `app`, internal port `3000` |
| API HTTP target | Service `api`, internal port `3001` |
| AI baseline | Disabled; do not load the agent overlay |
| Persistent state | Installation-owned `postgres-data`; Redis contains disposable cache state |
| Host ports | None |
| Shared predefined networks | Do not enable without a reviewed isolation requirement |
| Automatic production deployment | Do not enable before release and migration acceptance |

Coolify generates proxy configuration for entered service domains.
Its service-domain port suffix selects the internal target port, not a public host port.
Keep `APP_URL` and `API_URL` equal to the real browser origins, not those internal target-port values.
These mechanisms appear in the [official Docker Compose guide](https://coolify.io/docs/applications/builds/docker-compose).

No CRM hostname is accepted yet. Do not use a generated public wildcard domain as a shortcut.
Do not enable Funnel, WAN exposure, or host port forwarding.
Confirm private DNS, certificate issuance, routing, and tailnet access control before acceptance.
Tailscale availability on the PC does not prove private DNS availability inside containers.

## Bootstrap order for future authorized validation

1. Freeze the source release and verify the image digests.
2. Verify the actual Coolify-generated Compose project, network, volume, and service mapping.
3. Load installation secrets through the approved resource environment.
4. Start only PostgreSQL and Redis in the authorized test environment.
5. Run the explicit migration tool. It must pass deployment, schema drift, and application grant checks.
6. Provision the first owner through the local operator CLI using the application database role.
7. Start API, application, and cron. AI stays off.
8. Test login, onboarding, manual CRM workflows, role boundaries, and cron results.
9. Restart and recreate containers. Recheck data persistence, effective limits, logs, and authentication.
10. Run backup and restored-database application smoke tests. Test rollback before accepting the release.

The migration service uses the `tools` profile. A normal stack start does not migrate or seed the database.
Never start the business services against an unmigrated database.
Never add migrations to image build steps. Never run a seed with company data.

For first-owner provisioning, a future operator uses an API-image one-time command:

```text
docker compose run --rm --no-deps api bun /workspace/packages/auth/scripts/provision-user.ts --bootstrap
```

The operator enters the password directly. Do not put it in a command argument or report.
Verify the exact CLI argument contract and terminal behavior during container acceptance.
Local accounts need no Google account. Operator provisioning does not open public registration.

Coolify supports custom Compose build and start commands.
Validate a staged bootstrap command against the installed version and its generated Compose definition before saving it.
Do not paste an untested chained command or bypass the generated project mapping.
This package does not assert that ordinary Coolify Deploy performs the staged bootstrap above.

## Isolation and health acceptance

Inspect the generated configuration privately. Do not export secrets from `docker compose config` into evidence reports.
Confirm PostgreSQL and Redis have no proxy domain, published port, or shared external network.
Confirm API and application proxy labels target the correct service and internal port.
Test container-to-API HTTPS access, cookies, trusted origins, and Secure cookie behavior.
Test a database restart and a failed cron request. Do not hide a failed health check.

The application health check reads `/sign-in`. It does not prove authenticated CRM workflows.
The API health check requires database readiness. The agent check uses its private authenticated AI-status endpoint.
Cron health checks its heartbeat and recorded job results. It does not prove a job runs before its first schedule.
Cron uses UTC and does not recover missed schedules after downtime. Investigate failed jobs before replay.

## Issues

1. NOT DONE — The installed Coolify version and its generated deployment mapping lack validation for this CRM.
   Fix: validate staged bootstrap and persistence in an authorized test environment before pilot admission.
2. UNKNOWN — Private DNS, TLS, cookies, and container-to-API connectivity remain unverified.
   Fix: test the accepted routing design without changing PC or homelab networking in this task.
3. NOT DONE — Cron has no persistent missed-schedule recovery or external alert routing.
   Fix: complete scheduling and alert acceptance before relying on operational guarantees.
