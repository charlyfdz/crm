# Private installation package

Status: local implementation. No installation is authorized. The complete CRM release comes before the pilot installation.

The first pilot belongs to Corporativo S&F. Personal-Carlos owns the homelab infrastructure.
Each company receives a separate installation, database, credentials, and operations record. This product is not SaaS.

## Package

| Artifact | Purpose |
| --- | --- |
| `deploy/compose.yml` | PostgreSQL 17, Redis, API, Next.js, cron, and an explicit migration tool |
| `deploy/compose.agent.yml` | Optional AI service with the `agent` profile |
| `deploy/Dockerfile` | Separate build targets, non-root application processes, and MIT license copies |
| `deploy/scripts/preflight.mjs` | Environment and resource checks without service changes |
| `deploy/scripts/admission.mjs` | Acceptance declarations, current capacity, image digests, and authorization checks |
| `deploy/admission.pending.json` | Pending pilot record; this record rejects admission |
| `deploy/scripts/operations.mjs` | Backup plans and new-database restore plans; execution needs `--execute` |
| `.dockerignore` | Excludes credentials, local databases, caches, private keys, and backup archives |

No service publishes a host port. PostgreSQL and Redis use the internal data network.
Only the application and API declare HTTP target ports for an approved private proxy.
Telemetry stays disabled. AI stays disabled. The base Compose file has no AI service.
The agent overlay needs separate acceptance, resources, and explicit AI enablement.

## Read next

- [Environment contract](environment-contract.md)
- [Capacity and admission](capacity-admission.md)
- [Coolify preparation](coolify-preparation.md)
- [Backup, restore, and rollback](recovery.md)
- [Validation evidence](validation-20261002.md)
- [Principal handoff](principal-handoff.md)

## Local checks

Run these commands from the repository root. They use synthetic inputs and do not contact the server.

```powershell
node --test deploy/scripts/contracts.test.mjs deploy/scripts/safety.test.mjs deploy/scripts/health.test.mjs
bun deploy/scripts/validate-static.mjs
```

The static check parses YAML through Bun. It is not `docker compose config` validation.
The unit tests validate plans and guards. They do not execute PostgreSQL, migrations, or restores.

## Issues

1. NOT DONE — Docker images, database recovery, and container resource limits lack runtime evidence.
   Fix: validate the frozen release in an authorized Docker environment before admission.
2. NOT DONE — Pilot routing, quotas, lifecycle acceptance, and deployment authorization remain pending.
   Fix: complete the pilot record after the full CRM passes acceptance.
3. RISK — A database dump excludes external files and credentials. It does not recover the complete installation.
   Fix: add accepted file-storage recovery and a separate secret-recovery procedure before admission.
