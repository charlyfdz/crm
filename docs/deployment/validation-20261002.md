# Local static validation receipt

Date: 2026-10-02. Target checkout: `CRM Corporativo`.
Scope: `deploy/**`, `.dockerignore`, and `docs/deployment/**` only.
This receipt does not declare a complete CRM version or production readiness.

## Executed validation

| Check | Result | Boundary |
| --- | --- | --- |
| `node --test deploy/scripts/contracts.test.mjs deploy/scripts/safety.test.mjs deploy/scripts/health.test.mjs` | 42 passed; 0 failed | Synthetic plans, boundary guards, mocked HTTP probes, and non-mutating CLI tests |
| `bun deploy/scripts/validate-static.mjs` | Passed | YAML parsing and repository contracts; not Docker Compose schema or runtime validation |
| `node --check` for every `deploy/scripts/*.mjs` | 17 modules passed | Syntax only |
| Git Bash `bash -n` for both startup shell scripts | Passed | POSIX syntax only; neither script executes |
| Biome check for `deploy/scripts` | 0 errors; 5 environment warnings | Principal-owned Turbo declarations remain absent |
| Scoped `git diff --check` | Passed | No tracked whitespace errors; untracked package files also receive formatter and syntax checks |

Local tooling: Node 26.5.0 and Bun 1.4.2. Container versions remain separate and unvalidated.
The test limits and admission records are synthetic fixtures. They never establish real quotas or authorization.

## Repaired findings

The initial static validator resolves the parent workspace instead of the CRM checkout. Its baseline run fails with `ENOENT`.
The corrected shared root passes validation. A regression test checks the Compose file and Prisma schema locations.

The initial package publishes loopback host ports and shares the API network namespace with the application.
The prepared Coolify package removes those ports and assigns independent service networks and proxy targets.

The initial restore verifies database tables without reapplying application grants.
The revised restore plan requires schema verification, grant-only application permissions, and an application smoke-test gate.
Unit tests enforce that grant-only restoration applies no new migration or destructive data command.

The initial operations script executes as soon as the CLI receives its positional arguments.
The revised CLI returns a plan by default. A subprocess test proves it needs no Docker or archive writes.

## No executed operational actions

No Docker installation, image build, container start, migration, backup, restore, seed, or runtime test occurs.
No SSH session, Coolify mutation, Tailscale change, server installation, or remote platform write occurs.
No credential file, database dump, third-party environment, or business record enters this package.
No CRM source repository, domain, quota, deployment, or complete-version acceptance is created.

## Files

Package files: `.dockerignore`, `deploy/Dockerfile`, `deploy/compose.yml`, `deploy/compose.agent.yml`, and `deploy/admission.pending.json`.
Script files: all 17 modules under `deploy/scripts`, plus the two image-owned shell scripts.
Documentation: all files under `docs/deployment`.
No app, API, database, authentication, root environment, root package, Turbo, or lock file is edited by this task.

## Issues

Principal addendum, 2026-10-02: root environment placeholders and Turbo passthrough now include deployment-specific variables.
The static validator and 42 tests pass after integration. Issue 1 below describes the earlier specialist handoff.
The [principal receipt](../verification/2026-10-02-local-foundations.md) records current results and remaining limits.

1. NOT DONE — Root environment documentation and Turbo passthrough do not contain the deployment-specific variables.
   Fix: principal reconciles the handoff list. I add the deployment-variable requirements in this package.
2. NOT DONE — Docker schema validation, Linux builds, fresh migrations, restored-application tests, and effective limits remain unverified.
   Fix: execute authorized runtime acceptance after complete-version development. Do not install or deploy in this task.
3. UNKNOWN — Actual Coolify mappings, private DNS, TLS, and cookie behavior remain unverified.
   Fix: validate the accepted private routing and staged bootstrap against the installed platform before admission.
4. NOT DONE — Backup automation, encrypted recovery, complete file backups, and offsite protection remain outside this package.
   Fix: accept and implement recovery operations before production guarantees. Keep the rejected disk unused.
5. NOT DONE — Current capacity, company workload lifecycle, complete-version acceptance, and deployment permission remain pending.
   Fix: obtain current evidence and explicit owner acceptance. The pending admission record stays closed.
