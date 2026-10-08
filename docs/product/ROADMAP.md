# Release roadmap and implementation handoff

Updated: 2026-10-02.
Status: proposed delivery sequence within the approved complete product objective.
No dates, release durations, prices, or business acceptance are asserted.
Each release requires its exit evidence before the team promotes its status.
Optional capability remains in scope but never blocks the local core release.

## First-installation constraint

Corporativo S&F is the first pilot. Its future target is Coolify on `paas-control` inside homelab.
The user prohibits installation now and requires the complete version first.
R1 is a local foundation prototype, not a release for that installation.
The first candidate requires complete R2 features, R3 technical evidence, and applicable R4 technical delivery rehearsals.
The [pilot gate](PILOT-CORPORATIVO-SF.md) defines that boundary and the separate future authorization decision.
Current work uses local isolated rehearsals. It never creates staging or production resources on homelab.

## Releases

| Release | Outcome | Scope and increments | Exit evidence |
| --- | --- | --- | --- |
| R0 — Source and contract baseline | Team starts from a shared, inspectable product contract. | Product documents, source inventory, gap classification, traceability, license preservation, and scope boundaries. | Document checks, source-link checks, requirement coverage, and principal review. Runtime acceptance stays pending. |
| R1 — Local CRM foundations | A synthetic team rehearses foundational sales work without external services. | Dedicated instance contract; controlled local access; users; permissions; account/contact CRUD; buying roles; opportunity history; assigned tasks; basic reports; audit; default privacy. | R1 scenarios, L-01 through L-04 core subset, L-07 basic reconciliation, and L-09 denied-egress observation. |
| R2 — Professional configurable CRM | The team configures, migrates, and manages the complete commercial process. | Account/contact merge; configurable multiple pipelines; stage migration; notes; private document versions; local calendar; import/export; saved views; reports; regional settings; client templates; branding; archive; accessibility; renewal. | All R1/R2 scenarios and applicable L-01 through L-10. Run the entire commercial path. |
| R3 — Private production candidate | Operators install, recover, and update the CRM from production artifacts. | Complete private-server package; backup and restoration; upgrade and recovery; TLS; safe logs; readiness; session controls; scoped keys; private jobs; measured sizing. | P-01 through P-11 plus applicable local gates. Deployment authority remains a separate P-12 decision. |
| R4 — Repeatable company delivery | The same package serves independent client implementations with a commercial handover kit. | MIT release kit; configuration profiles; migration/training templates; ownership transfer; support revocation; separate client A/B rehearsals; service offer proposal. | D-01 through D-06 and D-08. Real terms and client acceptance remain pending D-07. |
| R5 — Optional intelligence and integrations | Clients enable approved external capabilities without losing local independence. | AI enablement, sourced suggestions, human review, budgets, scoped keys, optional mail/calendar adapters, external-action control, and worker scheduling. | AC-028 through AC-030 with authorized test accounts. Repeat L-09 with those capabilities disabled. |

The matrix assigns each requirement its final completion release.
The roadmap exposes earlier increments needed for end-to-end behavior.
No requirement marked complete relies on an unfinished mandatory increment.

## Mandatory R1 increments

R1 delivers usable foundations of later requirements.
These increments do not mark the whole later requirement complete.

| Later requirement | R1 increment | Final completion |
| --- | --- | --- |
| REQ-005, REQ-006 | Account/contact create, edit, archive, normalized conflict handling, and ownership. | R2 adds reviewed merge and complete lifecycle. |
| REQ-010, REQ-011 | Preserve baseline stages and explicit outcome rules. Document later stage mapping. | R2 supplies configurable pipelines and migration execution. |
| REQ-015, REQ-016 | Manual notes and one private proposal file with authenticated upload/download. | R2 adds revisions, versions, and complete file lifecycle. |
| REQ-023, REQ-025 | Explicit locale, timezone, supported reporting currency, and manual rate configuration. | R2 adds complete client profiles and proposed MXN support. |
| REQ-027 | Archive/restore behavior and archive exclusion in basic totals. | R2 adds elevated purge, impact preview, and scheduler policy. |
| REQ-032 | Minimal loopback package or coordinated local start with persistent database and file root. | R3 supplies clean-server production artifacts and complete installer. |
| REQ-033, REQ-034 | Fresh synthetic fixtures, reversible migration design, and recovery contracts before importer or stage migration. | R3 proves full backup restoration and release recovery. |
| REQ-037 | Fresh secrets, protected passwords, rate limiting, session revocation, and operator recovery. | R3 completes production security gates. |
| REQ-042 | Won closure creates an accountable manual handoff task. | R2 completes renewal links and the full operational reference flow. |

R1 is a local foundation prototype, not the complete S&F pilot or a production release.
R2 is a complete local feature candidate, not evidence of production readiness.
R3 provides production evidence, not permission to deploy.
R4 provides distribution evidence, not an approved sale or accepted client installation.
R4 technical rehearsals support the first pilot candidate. D-06/D-07 commercial decisions precede a future commercial agreement.

## Workstream order

1. Principal reconciles source inventory and assigns bounded API, UI, model, operations, and QA work.
2. Architecture establishes the single-instance contract and business outcome vocabulary.
3. Identity and API establish audit, controlled owner bootstrap, active membership, and shared permissions.
4. Operations supplies fresh local configuration and the minimal persistent package.
5. CRM and UI complete owned records, activities, tasks, outcome history, and manual handoff.
6. Reporting corrects archive exclusions and reconciles basic totals before extending charts.
7. CRM model adds configured stages with tested migration and preserved historical snapshots.
8. Storage and calendar complete private documents and provider-independent scheduling.
9. Data migration adds preview, repeatable application, scoped export, and reconciliation.
10. Configuration and UI complete client profiles, locale, fields, and accessible flows.
11. Operations and QA prove clean installation, backup, restoration, upgrade, faults, and selected capacity.
12. Release and product prepare delivery, training, client boundaries, and two-instance rehearsal.
13. Agent and integrations add only explicitly enabled external capability after the core remains independent.

The principal coordinates schema changes before dependent API and UI work.
One principal dependency installation serves the shared cycle.
Specialists do not run concurrent installers.

## Useful implementation decisions

- Keep `Company`, `Contact`, `Deal`, and `Activity` as the starting business models.
- Keep singleton workspace semantics and dedicated databases per operating client.
- Use controlled local bootstrap and private administrator-created accounts.
- Keep an owner plus five declared product roles; enforce actions and ownership in services.
- Separate task author from task assignee.
- Keep one primary company link until a client requirement justifies wider account relationships.
- Replace stage enum coupling with configured stable stage IDs and fixed outcome classifications.
- Preserve historical stage snapshots and prior closure events.
- Implement private record documents separately from conversation attachments.
- Use previewed CSV import and permission-controlled portability export.
- Correct archive-aware aggregates before adding forecast or chart features.
- Preserve original money values and local manual rates.
- Disable every default external capability, including telemetry and favicon lookups.
- Store client configuration as data and templates in one versioned codebase.
- Deliver production artifacts with recovery evidence and MIT notices.
- Describe implementation, migration, customization, training, and support as commercial service proposals.

These decisions require no blocking product question before implementation starts.
The principal validates engineering details inside the assigned workstreams.

## Deferred owner decisions

| Decision | Needed before | Safe progress now |
| --- | --- | --- |
| Actual reviewers, operators, users, and read restrictions for confirmed pilot company Corporativo S&F | Candidate company review and real-user onboarding | Use synthetic profiles and roles. |
| Final client process labels and required fields | Client implementation | Implement the configurable starter template. |
| CRM hostname, quota, current headroom, backup destination, and recovery targets on the confirmed future target | Future admission and production acceptance | Prepare profiles and measure isolated rehearsals. Do not install on homelab. |
| External provider and data-transmission consent | Capability enablement | Complete the local core and disabled-state behavior. |
| Supplier legal identity, prices, contract, support commitments | Commercial agreement | Prepare blank service and handover templates. |
| Human deployment and client acceptance | Actual deployment or handover | Produce reviewable candidates and evidence. |

## Principal integration handoff

This specialist changes only `docs/product/**`, `PROJECT-CHARTER.md`, and `docs/team/README.md`.
The principal owns source edits, dependency installation, integrated verification, and knowledge-engine registration.
Record date, approved direction, source paths, scope, evidence, and unresolved gates during a separately authorized registration.
This document-only task changes no graph and grants no external writing or installation authority.
Do not convert these proposed defaults into external permission or claimed acceptance.
Refresh affected baseline rows after parallel code changes.

## Issues

1. NOT DONE — R1 through R5 require implementation and execution evidence.
   Fix: follow the matrix and promote releases only after their gates pass.
2. UNKNOWN — Real production and commercial decisions remain unapproved.
   Fix: obtain concrete owner decisions at the specified release gates.
