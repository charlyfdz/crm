# Corporativo S&F pilot contract

Decision and readback date: 2026-10-02.
Product: CRM Corporativo, independently installed per company. Not SaaS.
Candidate status: IN DEVELOPMENT.
Complete requirement acceptance: PENDING for all 44 requirements.
Homelab installation: NOT AUTHORIZED IN THIS TASK.

## Approved decision and scope

The user names Corporativo S&F as the first pilot company.
The user selects Coolify on `paas-control` inside homelab as the future deployment target.
The user requires a complete version before installation.
The user does not authorize installation now.
This decision replaces an unnamed first company. It does not reduce the independently installable product objective.

Each operating company receives its own instance, database, file root, users, secrets, backups, and configuration.
The product supports implementation and support services for other companies without shared SaaS tenancy.
The pilot uses the same versioned product, not a separate company code fork.
MIT notices remain in source and distributed substantial portions.

Homelab belongs to Personal — Carlos. The hosted CRM pilot retains Corporativo S&F's business boundary.
This distinction does not determine supplier legal identity or intellectual-property ownership.
No CRM hostname, company logo, actual user account, process label, price, or legal claim is assigned here.

## Verified source register

Readback verifies documentary content. It does not measure current server capacity or certify runtime state.
The direct user instruction governs the pilot choice and the prohibition on installation.

| Source | Source date or version | Verified fact and limit |
| --- | --- | --- |
| S-01 — Direct user mandate in this conversation | 2026-10-02 | Corporativo S&F is first pilot. Complete the version before installing in Coolify on `paas-control` inside homelab. |
| S-02 — [Linear COR-522](https://linear.app/corporativo-sf/issue/COR-522/f72-definir-capacidad-cuotas-y-placement-de-servicios-del-homelab) | Done; updated 2026-09-29T23:41:56.692Z | Non-core pool ceiling: 2.5 GiB RAM and 3.0 vCPU aggregate. This is neither a CRM allocation nor free capacity. |
| S-03 — [Linear COR-527](https://linear.app/corporativo-sf/issue/COR-527/f7g-gate-declarar-coolify-platform-ready-para-produccion-multi-entidad) | Done; updated 2026-09-17T15:48:45.309Z | Platform Ready enables individually governed admission. It does not admit this CRM or override the user's no-install instruction. |
| S-04 — [Linear COR-523](https://linear.app/corporativo-sf/issue/COR-523/f73-definir-alta-baja-y-catalogo-operativo-de-servicios) | Todo; updated 2026-09-24T23:40:13.070Z | Catalogue reconciliation exists. Repeatable onboarding, change, suspension, offboarding, and decommission remain open. |
| S-05 — [Canonical Homelab Control README](https://github.com/charlyfdz/homelab-portal/blob/main/README.md) | File SHA `7233633878a3644110dd243022dac5b3726d7cef`; lines 1–100 read | `charlyfdz/homelab-portal` is canonical. Coolify operates on `paas-control`. Documented admin endpoints are not CRM URLs. |
| S-06 — [Notion operating policy](https://app.notion.com/p/3d36b11dd94a81c6bf40e2875234abb2?pvs=204) | Page last edited 2026-09-17T06:14:38.703Z; native verification is unverified | Homelab belongs to Personal — Carlos. Hosted company services retain their entity. Historic incident statuses do not supersede newer Linear records. |
| S-07 — [Trello capacity closure](https://trello.com/c/mKPIjykB/108-cor-522-cerrado-capacidad-cuotas-y-placement-aprobados) | Last activity 2026-09-24T23:08:54.098Z; list Hecho | Confirms the aggregate ceiling and identifies Linear COR-522 as the live authority. It contains no CRM resource reservation. |
| S-08 — [Trello backup continuity](https://trello.com/c/A4mnbsjv/106-cor-504-cerrado-continuidad-operativa-y-quarantine-homelabbackup-aceptadas) | Last activity 2026-09-29T23:40:42.302Z; list Hecho | NVMe and HOMELAB_DATA provide same-host contingency. This is not offsite coverage or a tested CRM backup. |
| S-09 — Local knowledge-engine check and project context | Commands read on 2026-10-02 | `check` exits 2 with stale remote evidence. `project:crm-corporativo` still reports `owner_entity=unclassified`. No graph is changed. |

COR-523's newer open status supersedes COR-527's historic list of closed prerequisites.
That difference does not reopen Platform Ready or close the remaining service lifecycle work.
Current policy requires CRM-specific admission records and explicit authority before promotion.
No full cross-platform alignment or live capacity assessment is asserted.

## Complete-version release gate

R1 provides foundations only. It never permits the first homelab installation.
The candidate includes complete manual R2 features and R3 technical operating evidence.
It includes R4 technical delivery rehearsals without requiring a sale to another company.
All gate results below remain PENDING.

| Gate | Required pre-installation result | Trace |
| --- | --- | --- |
| SF-01 — Complete manual workflow | Accounts, contacts, opportunities, configurable pipelines, history, tasks, calendar, notes, files, imports, exports, reports, and client settings work together. | AC-005 through AC-027, AC-038, AC-042; L-04 through L-08 |
| SF-02 — Governed access | Local provisioning, sign-in, recovery, role enforcement, suspension, session revocation, scoped keys, and audit pass direct denial tests. | AC-002 through AC-004, AC-026, AC-037, AC-043; L-02, L-03; P-04, P-11 |
| SF-03 — Independent local core | The complete manual path runs with external egress denied. Disabled AI and providers never create a mandatory dependency. | AC-028 and AC-030 disabled-state assertions, AC-031; L-05, L-09; D-08 |
| SF-04 — Recoverable package | Production artifacts install in an isolated supported rehearsal. Database, files, and configuration restore consistently. Upgrade failure follows documented recovery. | AC-016, AC-032 through AC-034, AC-036; L-01, L-10; P-01, P-02, P-05, P-06, P-09 |
| SF-05 — Security and capacity | TLS configuration, trusted origins, private data services, safe logs, release security checks, and declared load meet approved targets. | AC-035 through AC-039; P-03, P-07, P-08, P-10, P-11 |
| SF-06 — Independent delivery | Two synthetic installations prove isolation. Notices, profiles, export, training, operator responsibility, and support revocation remain usable. | AC-001, AC-040, AC-041 technical rehearsal, AC-044; D-01 through D-05, D-08 |
| SF-07 — Company candidate review | S&F's authorized reviewer confirms process configuration, permission scope, required currency, workflow evidence, and disclosed operational limits. | AC-041 candidate review; company decision record |
| SF-08 — Future workload admission | Declare the service profile, refresh host evidence, approve a specific quota, and obtain separate installation authority for the exact candidate. | COR-522, COR-527, COR-523; P-10, P-12 |

These gates supplement the [acceptance plan](ACCEPTANCE.md). They never replace individual scenario assertions.
Required scenarios cover the manual core, privacy, operations, and technical delivery portions of the 44-requirement matrix.
Enabled AI and integration scenarios in AC-028 through AC-030 remain optional R5 work.
Their disabled-state assertions remain mandatory.
Commercial offer and contract approvals in D-06 and D-07 remain required before a future commercial agreement.
Those third-party terms do not block this internal pilot's implementation.

The company reviews a local candidate before installation. It does not accept an unobserved production service.
Final pilot acceptance requires post-installation checks, authorized user validation, and the actual company decision.
Real business data needs separate approval and a controlled import plan.
Passing every technical gate never grants installation authority automatically.

## Future admission profile

This profile is a preparation checklist. It creates no Coolify resource, hostname, secret, quota, or backup job.

| Field | Known value or remaining decision |
| --- | --- |
| Product and consumer | CRM Corporativo; Corporativo S&F first pilot. |
| Infrastructure boundary | Personal — Carlos; future Coolify placement on `paas-control` inside homelab. |
| Plan and service tracking | Company plan association and exact CRM deployment issue/checklist require principal reconciliation. No issue is invented. |
| Source and artifact | Local repository, branch `crm-corporativo`, baseline HEAD `6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`. Final revision and artifacts remain pending. |
| Remote source | No CRM Git remote is configured at inspection. The homelab repository is not the CRM source repository. |
| Environment and exposure | Final environment, P0–P4 class, private access route, and CRM hostname remain unset. No public exposure is approved. |
| Resources | Dedicated CPU/RAM/PIDs, connection limits, storage growth, and admission headroom require measurement and approval. |
| Persistence | Dedicated database, private files, configuration references, and optional worker state require the final package inventory. |
| Secrets and identities | Fresh per-instance secrets, privileged operators, rotation, and support expiry require protected provisioning. No secret values belong here. |
| Health and lifecycle | App/API readiness, dependencies, logs, job owners, update, rollback, suspension, and safe decommission require checked runbooks. |
| Recovery | Backup destination, schedule, retention, RPO, RTO, restore results, and same-host residual-risk decision remain pending. |
| Authority | Candidate review, installation permission, real-data permission, and final company acceptance require distinct records. |

COR-522 requires supported persistent Coolify resource limits, not ad hoc `docker update` changes.
Its recorded guest-disk admission threshold is at least 40 GiB free. Critical disk state starts below 30 GiB.
Its host-root policy requests review below 200 GiB and rejects projections below 150 GiB.
These thresholds are policy values, not today's free-space measurements.
The rejected backup disk stays outside this plan. No new hardware purchase or offsite coverage is assumed.
The future gate rechecks current policy, consumption, permissions, and recovery without disturbing unrelated services.

## Company questions and safe development defaults

The user supplies [S&F's website](https://www.corporativo-syf.com/) on 2026-10-02 as business context.
The [business-context note](SF-BUSINESS-CONTEXT.md) records published service areas, retrieval limits, and a proposed configurable rehearsal.
It does not confirm internal stages, people, permissions, prices, currencies, or live company data.

These questions remain open. They do not block generic implementation or synthetic rehearsals.
The client-specific choice becomes mandatory at the stated gate.

| Question | Safe progress now | Required before |
| --- | --- | --- |
| Who reviews business acceptance and who operates the installation? | Implement named roles and blank responsibility records. | SF-07 and SF-08 |
| Which actual users and read restrictions does S&F require? | Use synthetic role fixtures. Disclose the proposed workspace-wide read default. | SF-07 and real-user onboarding |
| Which stages, fields, loss reasons, approval evidence, and handoff rules reflect S&F's process? | Build configurable templates. Keep starter stages labelled as proposals. | SF-07 |
| Which locale, timezone, reporting currency, and manual-rate policy does S&F select? | Implement explicit settings and unsupported-currency errors. Do not assume MXN or USD. | SF-07 |
| Which sources, formats, attachments, and duplicate decisions apply to migration? | Test harmless CSV fixtures, preview, resumable import, and export. | Real-data permission and import |
| Which workload, concurrency, file growth, and response targets define acceptable operation? | Measure synthetic workloads and record results without commercial guarantees. | SF-05 and SF-08 |
| Which backup schedule, retention, RPO, RTO, and same-host risks does the company accept? | Supply adjustable policies and isolated restoration evidence. | SF-05 and SF-08 |
| Which future private URL and access group does the operator approve? | Parameterize origins and profiles. Create no DNS, ports, or network rules. | SF-08 |
| Does the company authorize any external data transmission? | Keep AI, providers, telemetry, and external lookups disabled. | Any capability enablement |
| Who supplies future commercial services, prices, contracts, and support commitments? | Prepare blank implementation and handover templates. Assert no legal or pricing claims. | Future D-06/D-07 agreement |

## Evidence and handoff limits

The historical principal handoff reports 49 passing unit tests across seven files.
The latest principal handoff reports 86 passing unit tests across nine files plus nine API environment-contract tests.
The combined reported result is 95 passing tests.
It also reports auth, DB, agent, and initial API typechecks, app type generation, app typecheck, and Next standalone production build.
The API typecheck precedes the AI changes. It does not validate their final integrated state.
The reported build exits 0 without a real database or Docker execution.
Product does not rerun these checks. The principal supplies exact receipts through its receipt plan.
These checks do not prove a full business flow, restoration, security acceptance, capacity, Docker package, or company acceptance.
The [baseline addendum](BASELINE.md) records the inspected implementation changes and the incomplete execution receipt.
No complete requirement changes to runtime accepted.

This delivery writes only product documents, the charter, and the team README.
It changes no graphs, external platforms, application code, server resources, or real accounts.
The principal receives graph reconciliation and future admission records as pending handoffs, not permission to execute them.

## Issues

Principal addendum, 2026-10-02: the [integrated receipt](../verification/2026-10-02-local-foundations.md) supersedes the historic 95-test total.
It records 260 selected passing tests and final integrated app/API builds. The complete pilot gates remain pending.
The motor now records the pilot consumer, future deployment target, and pending admission without assigning product legal ownership.
Issue 5 below describes the earlier product-only handoff. External alignment remains pending.

1. NOT DONE — Complete CRM scenarios and pilot gates lack integrated runtime acceptance.
   Fix: attach exact-revision execution receipts and complete the manual candidate before requesting installation.
2. UNKNOWN — Company process, users, reviewers, regional settings, and migration choices remain unset.
   Fix: collect these choices at the listed gates while generic implementation continues.
3. UNKNOWN — CRM allocation, current headroom, exposure profile, and recovery targets remain unapproved.
   Fix: measure and review the dedicated workload before future admission.
4. RISK — Documented backup contingency shares one host and site. It does not cover their combined loss.
   Fix: record the company's recovery decision and approved residual risk before admission.
5. NOT DONE — Knowledge-engine ownership and future service tracking are not reconciled by this document-only task.
   Fix: the principal handles a separately authorized reconciliation without asserting full platform alignment.
