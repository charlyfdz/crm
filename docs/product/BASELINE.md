# Source baseline and verification record

Inspection date: 2026-10-01.
Product addendum date: 2026-10-02.
Inspected HEAD: `6d4793d`.
The working tree contains `PROJECT-CHARTER.md` before this specialist starts.
Other specialists can change source files during the shared development cycle.
This inventory describes the inspected revision and named anchors.
Refresh affected rows after integration.

The original catalogue and capability inventory below describe the 2026-10-01 inspection.
They remain historical evidence, not current implementation claims.
The dated addendum records later inspected changes and verification limits.

## Evidence catalogue

Links resolve inside this repository.
An anchor identifies a model, method, or documented section.

| ID | Source | Anchor and evidence |
| --- | --- | --- |
| E-01 | [Schema](../../packages/db/prisma/schema.prisma) | `Company`, `Contact`, `Deal`, `DealContact`, `Activity`, `Organization`, and `Member`. |
| E-02 | [Auth configuration](../../packages/auth/src/auth.ts) | `emailAndPassword.enabled` is false. Social providers and OIDC SSO exist. |
| E-03 | [Workspace roles](../../packages/auth/src/organization.ts) | `WORKSPACE_ROLES`: owner, admin, member. `ensureWorkspaceMembership` enrolls users after sign-in. |
| E-04 | [Workspace service](../../apps/api/src/workspace/workspace.service.ts) | `update`, `members`, `setMemberRole`. Last-owner demotion protection exists. |
| E-05 | [Company router](../../apps/api/src/companies/companies.router.ts) | `list`, `create`, `update`, `archive`, `restore`, `purge`, and `setPrimaryContact`. |
| E-06 | [Contact router](../../apps/api/src/contacts/contacts.router.ts) | `list`, `create`, `update`, archive operations, bulk assignment, and fact decisions. |
| E-07 | [Deal service](../../apps/api/src/deals/deals.service.ts) | `create`, `setStage`, `attachContact`, `detachContact`, and `setContactRole`. |
| E-08 | [Deal contract](../../apps/api/src/deals/deals.contracts.ts) | Required company and owner. Stage validation uses the fixed `DealStage` enum. |
| E-09 | [Activities](../../apps/api/src/activities/activities.service.ts) | `timeline`, `create`, `complete`, and `myTasks`. Tasks use `createdById` as their user filter. |
| E-10 | [Activity contract](../../apps/api/src/activities/activities.contracts.ts) | Manual note, call, email, meeting, and task inputs. No assignee input exists. |
| E-11 | [Dashboard](../../apps/api/src/dashboard/dashboard.service.ts) | `summary` returns pipeline, won totals, performance, trends, overdue tasks, and activity. |
| E-12 | [Currency rules](../currency.md), [catalogue](../../packages/db/src/currency.ts) | Frozen rates, `baseAmount`, exclusions, manual rates, and eleven supported currencies. MXN is absent. |
| E-13 | [Fields](../../apps/api/src/fields/fields.contracts.ts), [service](../../apps/api/src/fields/fields.service.ts) | Typed fields, options, required flags, order, filters, archive, and backfill. Agent fill defaults to true. |
| E-14 | [Saved views](../../apps/api/src/saved-views/saved-views.contracts.ts) | Entity, name, shared flag, and persisted filter definitions. |
| E-15 | [Conversation files](../../apps/api/src/conversations/conversation-attachments.ts), [schema](../../packages/db/prisma/schema.prisma) | `AgentConversationAttachment` stores submission files. It does not represent general CRM documents. |
| E-16 | [API rules](../api.md), [environment](../environment.md) | Singleton workspace, required website, research-key gate, mailbox gates, and upstream telemetry default. |
| E-17 | [Capabilities](../../apps/agent/agent/lib/capabilities.ts), [agent panel](../agent-panel.md) | Optional research sources, missing-key behavior, and durable record conversations. |
| E-18 | [Connections](../connections.md) | Shared connections, owner/admin management, and optional capability model. |
| E-19 | [Setup](../setup.md), [Compose](../../docker-compose.yml) | Compose contains PostgreSQL only. Setup describes Bun, migrations, and Vercel-specific schedules. |
| E-20 | [Package](../../package.json), [license](../../LICENSE) | MIT declaration and upstream copyright. Bun 1.3.12 and Node >=22 appear in package metadata. |
| E-21 | [Auth middleware](../../apps/api/src/trpc/middlewares/auth.middleware.ts) | Session validation exists. It does not check a business action or record owner. |
| E-22 | [Favicon service](../../apps/api/src/companies/favicon.service.ts), [company service](../../apps/api/src/companies/companies.service.ts) | Company creation and domain changes invoke favicon lookup. External calls need a default privacy gate. |
| E-23 | [Charter](../../PROJECT-CHARTER.md), [security](../../SECURITY.md), [legacy plan](../crm-plan.md) | Internal pilot, broad historic access, and planned capabilities. These sources do not prove current acceptance. |
| E-24 | [Older plan](../plan/crm-plan.md), [list roadmap](../list-building-roadmap.md) | Older exclusions conflict with later code for fields, views, roles, mail, and calendar. |
| E-25 | [API tests](../../apps/api/test), [auth tests](../../packages/auth/test), [agent tests](../../apps/agent/test) | Test files exist. No test execution receipt is created by this specialist. |
| E-26 | [UI record sheets](../../apps/app/components/crm/record-sheet), [UI routes](../../apps/app/app) | Companies, contacts, deals, overview, members, fields, and connection surfaces exist. |

## Capability inventory

`INSPECTED / PENDING` means source inspection succeeds while runtime verification remains pending.

| Capability | Implementation at inspection | Evidence | Verification | Required change |
| --- | --- | --- | --- | --- |
| One workspace and CRM database | EXISTING | E-01, E-03, E-16 | INSPECTED / PENDING | Prove separate installation boundaries and remove shared container assumptions. |
| Local password access | TO IMPLEMENT | E-02 | INSPECTED / PENDING | Enable private local access and controlled bootstrap. |
| Owner/admin/member management | EXISTING | E-03, E-04 | TEST PRESENT / PENDING | Add product roles, lifecycle, and restricted promotion authority. |
| Record-level corporate permissions | TO IMPLEMENT | E-05 through E-08, E-21 | INSPECTED / PENDING | Enforce action and ownership rules in every write path. |
| Account and contact CRUD | EXISTING | E-01, E-05, E-06 | TEST PRESENT / PENDING | Complete lifecycle, duplicates, controlled merge, and acceptance. |
| Primary company and deal contacts | EXISTING | E-01, E-07 | TEST PRESENT / PENDING | Preserve current company constraints and document buying roles. |
| Opportunities and close events | EXISTING | E-07, E-08 | INSPECTED / PENDING | Add next actions, evidence requirements, and authorized transitions. |
| Configurable pipelines | TO IMPLEMENT | E-01, E-08 | INSPECTED / PENDING | Replace fixed enum coupling with configured stages and outcome classes. |
| Timeline and manual activities | EXISTING | E-09, E-10 | INSPECTED / PENDING | Validate linked-record consistency and audit edits. |
| Assigned task management | PARTIAL | E-09, E-10 | INSPECTED / PENDING | Separate author and assignee; add reassignment, priority, and rescheduling. |
| Provider calendar ingestion | EXISTING | E-01, E-16 | TEST PRESENT / PENDING | Make optional and provide local appointments. |
| Local calendar | TO IMPLEMENT | E-01, E-10, E-26 | INSPECTED / PENDING | Add local appointment creation, editing, cancellation, and calendar views. |
| Notes | PARTIAL | E-09, E-10 | INSPECTED / PENDING | Add edit history and controlled removal. |
| General business documents | TO IMPLEMENT | E-15 | INSPECTED / PENDING | Add private record attachments independent of agent conversations. |
| CSV intake and application | TO IMPLEMENT | E-05 through E-08, E-23, E-24 | INSPECTED / PENDING | Plans mention import; inspected routers expose no complete CSV workflow. |
| Controlled business export | TO IMPLEMENT | E-05 through E-08 | INSPECTED / PENDING | Add scoped export and portability manifests. |
| Search, filters, saved views | EXISTING | E-05, E-06, E-08, E-14 | INSPECTED / PENDING | Recheck permissions, archived records, and configured stage filters. |
| Basic dashboard | EXISTING | E-11 | INSPECTED / PENDING | Add configurable reporting and reconcile archived-record semantics. |
| Multi-currency totals | EXISTING | E-12 | TEST PRESENT / PENDING | Add requested supported currencies and offline rate policy. |
| Custom fields | EXISTING | E-13 | TEST PRESENT / PENDING | Add administrator gates, client templates, and disabled agent fill defaults. |
| Branding and installation profile | PARTIAL | E-04, E-26 | INSPECTED / PENDING | Add private logos, locale, timezone, and portable configuration templates. |
| General audit trail | PARTIAL | E-01, E-07 | INSPECTED / PENDING | Agent audit and stage activities do not audit all business and administration changes. |
| Archive and retention | EXISTING | E-05, E-06, E-16 | TEST PRESENT / PENDING | Add elevated purge policy, dependency preview, and private scheduler. |
| AI research and conversations | EXISTING | E-17 | TEST PRESENT / PENDING | Add explicit installation enablement, scoped inputs, approval, and cost controls. |
| Privacy by default | TO IMPLEMENT | E-13, E-16, E-22 | INSPECTED / PENDING | Gate telemetry, agent tasks, provider sync, favicons, images, and rates. |
| Private-server application package | PARTIAL | E-19, E-20 | INSPECTED / PENDING | Package app, API, private storage, database, health, and optional agent. |
| Backup, restore, upgrade, rollback | TO IMPLEMENT | E-19 | INSPECTED / PENDING | Supply runbooks and executable rehearsal evidence. |
| Commercial implementation kit | TO IMPLEMENT | E-20, E-23 | INSPECTED / PENDING | Add client profiles, delivery checks, training, and repeatable isolated installation. |

## Conflicts that affect implementation

1. The upstream access model admits broad record writes after sign-in.
   Corporate role names alone do not enforce the target permissions.
2. `docs/crm-plan.md` proposes many-to-many accounts, an admin plugin, and general attachments.
   The schema uses one company link and workspace roles.
3. `docs/plan/crm-plan.md` excludes roles, custom fields, and provider sync.
   Later code contains parts of those capabilities.
4. Onboarding requires a website and research key.
   The target supports a company without a website or external provider.
5. The upstream telemetry default permits transmission.
   The target disables external transmission by default.
6. Dashboard deal queries omit `archivedAt` filtering at the inspected anchors.
   Archived deals enter default aggregates until the implementation reconciles that rule.
7. The baseline Compose file provides the database only.
   It does not prove a complete private-server installation.
8. The baseline currency catalogue excludes MXN.
   Client configuration must expose that limit until support exists.

## Original verification performed — 2026-10-01

- Read root `AGENTS.md`, the charter, relevant area rules, license, schema, contracts, services, and test excerpts.
- Read the repository `ux-flow-plan` skill and apply its current-flow and target-flow structure.
- Inspect Git status and HEAD before product edits.
- Inspect the knowledge-engine check and project context through local commands.
- Observe that the knowledge-engine check reports stale remote snapshots and exits with a failure status.
- Treat graph facts as documentary context only.
- Locate test suites without executing them.

No installation, application build, database migration, server, provider call, or production acceptance runs in this specialist task.
Prior laboratory receipts do not establish results for this repository.
No laboratory file or existing environment file is read or changed.

## Product and pilot addendum — 2026-10-02

The current user mandate names Corporativo S&F as the first pilot company.
The future target is Coolify on `paas-control` inside homelab.
The user requires a complete version before installation and prohibits installation now.
The [pilot source register](PILOT-CORPORATIVO-SF.md) contains direct readbacks and their exact documentary limits.

Current inspected HEAD: `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`.
Branch: `crm-corporativo`. The inspected working tree contains uncommitted implementation changes.
No CRM Git remote is configured. HEAD alone does not identify the complete modified tree.

| ID | Source | Later inspected evidence and limit |
| --- | --- | --- |
| E-27 | [Auth](../../packages/auth/src/auth.ts), [provisioning](../../packages/auth/src/provision-user.ts), [operator CLI](../../packages/auth/scripts/provision-user.ts) | Password sign-in is enabled. Public sign-up is closed. Provisioning uses credential hashing and a transaction lock. Whole identity acceptance remains PENDING. |
| E-28 | [Dashboard money](../../apps/app/lib/dashboard-money.ts), [test](../../apps/app/test/dashboard-money.spec.ts) | A deterministic currency formatter and unit suite exist. This does not prove report reconciliation, currency support, or complete locale behavior. |
| E-29 | [Telemetry policy](../../packages/telemetry/src/disabled.ts), [AI feature policy](../../packages/env/src/features.ts), [AI handoff](../ai/principal-handoff.md) | Telemetry requires opt-in. The shared AI flag requires exact `true`. The handoff lists API/UI integration work. Full denied-egress behavior remains PENDING. |
| E-30 | [Pool configuration](../../packages/db/src/pool-config.ts), [pool errors](../../packages/db/src/pool-errors.ts), [integration suite](../../packages/db/test/pool-recovery.integration.spec.ts) | Pool policy, safe-error helpers, and a fault-recovery suite exist. No fault execution or closed-connection diagnosis is certified here. |
| E-31 | [Deployment Compose](../../deploy/compose.yml), [Dockerfile](../../deploy/Dockerfile) | Packaging artifacts are present. File presence does not prove builds, migrations, Coolify compatibility, recovery, or capacity. |
| E-32 | Principal execution handoff received 2026-10-02; selected test files listed below | Reported result: 49 pass, 0 fail, 280 expectations, seven files. This specialist does not rerun that command. Formal integrated receipts remain incomplete. |
| E-33 | [Pilot contract and sources](PILOT-CORPORATIVO-SF.md), [charter](../../PROJECT-CHARTER.md) | Company, future placement, complete-version gate, and no-install boundary are recorded. No legal ownership or workload admission is inferred. |
| E-34 | Latest principal handoff in this conversation, received 2026-10-02 | Reports 95 passing tests, static typechecks, and a standalone Next production build. Product does not rerun them. Runtime business acceptance remains PENDING. |

E-27 supersedes the old disabled-password observation in E-02 for this working tree.
It does not prove bootstrap concurrency, sign-in, recovery, suspension, or the complete target permission catalogue.
E-29 supersedes the upstream telemetry default observation for the inspected helper only.
It does not prove all API queues, provider callers, favicon lookups, and external-rate paths are disabled.
E-31 adds packaging work beside the original database-only Compose. Neither file set supplies runtime acceptance by itself.
The principal refreshes affected source rows after integration, with exact execution evidence.

### Historical partial unit-test handoff

Reported command:

```text
bun test packages/auth/test/provision-input.spec.ts packages/telemetry/test/disabled.spec.ts packages/env/test/features.spec.ts packages/db/test/pool-config.spec.ts packages/db/test/pool-errors.spec.ts packages/db/test/pool-test-guard.spec.ts apps/app/test/dashboard-money.spec.ts
```

Reported outcome: 49 pass, 0 fail, 280 expectations, seven files.
The test files exist at inspection.
The original execution timestamp and complete working-tree fingerprint are not attached to this product delivery.
This is a partial handoff result, not a fresh product execution receipt.
It proves no complete requirement, build, browser path, database recovery, security gate, capacity profile, or company acceptance.
All 44 requirements retain complete runtime acceptance as PENDING.

### Latest principal verification handoff

The newer handoff supersedes the 49-test count as the latest reported test coverage.
It preserves the older result as historical evidence.

| Check | Principal's reported result | Limit |
| --- | --- | --- |
| Selected unit suites | 86 pass across nine files. | Exact per-test runtime scenarios and complete revision receipt remain principal deliverables. |
| API environment contract | Nine pass from the API working directory. Combined count: 95 passing tests. | Environment parsing tests do not execute business flows. |
| Auth and DB typechecks | PASS. | Static checks do not prove database operation, provisioning concurrency, or recovery. |
| API typecheck | PASS before the AI integration changes. | It does not prove the final API integration. |
| App type generation and TypeScript | `next typegen` and `tsc` PASS. | Static compatibility does not prove browser interaction. |
| Next production standalone build | PASS, exit 0; no real DB or Docker. | Build success does not prove deployed service health or installation acceptance. |
| Agent TypeScript | PASS after the principal's type-guard correction. | It does not prove provider behavior, queue operation, or disabled-state business flow. |

These results come from the principal's direct handoff, not execution by this product specialist.
The principal supplies exact commands, revision, environment, and output references through its receipt plan.
No receipt filename is invented here.
Runtime business flows remain unverified. Every complete requirement acceptance remains PENDING.

### Verification of this document update

Read `AGENTS.md`, the relevant product documents, the charter, and the team README completely.
Apply the repository's clear-writing skill to distinguish decisions, requirements, source inspection, and executed acceptance.
Read Linear COR-522, COR-527, and COR-523 through their connectors.
Read the canonical GitHub README, the Notion entity policy, and the relevant Trello closure cards.
Preserve source dates and historic differences. Do not treat native Notion verification as product acceptance.
Run the local knowledge-engine check and scoped project context without changing graphs.
The check exits 2 with stale remote evidence. The project context still reports `owner_entity=unclassified`.
Use live responsible-source reads for the narrow documentary facts rather than claiming refreshed graph alignment.
Check the license hash. It matches the original hash below.

Document validation checks 12 files, 88 local links, 44 requirement rows, and 44 matching story/scenario pairs.
It reports no missing links, missing IDs, duplicate IDs, or trailing whitespace.
The scoped `git diff --check` exits 0.
The team record preserves all five historical specialist identifiers without current execution claims.

This task changes only product documents, the charter, and the team README.
No application test, build, install, migration, service, external write, or homelab change runs in this product task.

## Verification handoff

### Principal integrated receipt — 2026-10-02

The [integrated receipt](../verification/2026-10-02-local-foundations.md) records exact commands, base revision, environment, and six file hashes.
It supersedes the earlier totals with 260 selected passing CRM tests and final app/API builds and typechecks.
The local auth harness verifies eleven scenarios through BetterAuth HTTP and a disposable PGlite database.
It does not prove PostgreSQL 17 migrations, provisioning concurrency, operational recovery, or browser acceptance.
The AI direct writers and interface receive integration after the product inspection.
The 44 complete requirement scenarios remain pending.

The motor now records S&F as pilot consumer and `paas-control` as future target.
Product legal ownership remains `unclassified`. Pilot consumption does not assign ownership or installation authority.
General remote freshness and external platform synchronization remain separate pending tasks.

The principal attaches exact revision and environment to each `AC-xxx` execution.
The principal records successful and failed assertions without copying secrets or customer records.
Knowledge-engine registration remains a principal handoff requiring a separately authorized integration scope.
Product files remain the complete local source for this specialist delivery.

License SHA256 at inspection:
`07637F32627C9D696769A074BDAD12AD7B0C66C433BEA3F5682CA07B0917004F`.

## Issues

1. NOT DONE — Runtime verification remains pending across the capability inventory.
   Fix: execute isolated acceptance scenarios after integration.
2. RISK — Default dashboard queries include archived deals.
   Fix: implement archive-aware aggregate filters and reconciliation tests.
3. RISK — Upstream defaults permit external activity before corporate privacy acceptance.
   Fix: implement explicit capability gates and observe denied-egress operation.
4. NOT DONE — Knowledge-engine snapshots remain stale and project ownership remains unclassified in its local context.
   Fix: the principal performs a separately authorized reconciliation. This product delivery changes no graph.
