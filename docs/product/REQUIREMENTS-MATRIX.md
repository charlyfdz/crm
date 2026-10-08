# Traceable requirements matrix

Date: 2026-10-03. The original baseline remains historical.
Baseline: `6d4793d` and inspected anchors in [BASELINE.md](BASELINE.md).

## Interpretation

`P0` protects data, authority, or an essential operating path.
`P1` completes professional CRM operation and commercial delivery.
`P2` adds optional capability after the complete local core.
Priority states delivery order; it never removes a requirement.

Status describes the whole target requirement.
An existing component can therefore belong to a PARTIAL requirement.
All runtime verification remains PENDING.
Relevant test presence appears in the source baseline, not as acceptance success.

The [pilot contract](PILOT-CORPORATIVO-SF.md) defines the complete candidate before any S&F homelab installation.
R1 is a foundation prototype. Required R2/R3 behavior and R4 technical rehearsals precede the future installation decision.
All 44 full runtime acceptance results remain PENDING.
The original handoff reports 95 passing tests. That count remains historical, not the current selected regression count.
The [managed identity receipt](../verification/2026-10-03-managed-identity.md) records 370 selected cases and bounded HTTP evidence.
Complete acceptance remains PENDING. Historical receipt counts are never added together.
The original source inventory remains historical. The 2026-10-02 addendum records inspected changes without claiming integrated acceptance.

Each row maps to a numbered story and acceptance scenario in [USER-STORIES.md](USER-STORIES.md).
`US-001 / AC-001` through `US-044 / AC-044` use the matching requirement suffix.
Release is the required completion gate.
Earlier releases contain increments where the roadmap states them.
Dependencies refer to requirement suffixes, for example `002` means `REQ-002`.
Delivery owners identify team functions, not invented people.

## Matrix

| Requirement | Required outcome | Current target status | Source | Story / scenario | Priority | Release | Dependencies | Delivery owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | One company and dedicated persistent resources | PARTIAL | E-01, E-03, E-16 | US-001 / AC-001 | P0 | R1 | 032 | Architecture, operations |
| REQ-002 | Controlled owner bootstrap and local access | PARTIAL | E-02, E-03, E-27, E-32 | US-002 / AC-002 | P0 | R1 | 001, 037 | Identity, API |
| REQ-003 | User creation, invitations, suspension, reassignment | PARTIAL | E-03, E-04 | US-003 / AC-003 | P0 | R1 | 002, 004 | Identity, UI |
| REQ-004 | Role and record permission enforcement | PARTIAL | E-05, E-06, E-07, E-21 | US-004 / AC-004 | P0 | R1 | 002, 026 | Identity, API, QA |
| REQ-005 | Account lifecycle, duplicate review, controlled merge | PARTIAL | E-01, E-05 | US-005 / AC-005 | P1 | R2 | 004, 026 | CRM API, UI |
| REQ-006 | Contact lifecycle and controlled duplicate handling | PARTIAL | E-01, E-06 | US-006 / AC-006 | P1 | R2 | 004, 005, 026 | CRM API, UI |
| REQ-007 | Primary account and opportunity buying relationships | PARTIAL | E-01, E-07 | US-007 / AC-007 | P1 | R1 | 005, 006 | CRM API, UI |
| REQ-008 | Owned opportunity and next-action completeness | PARTIAL | E-07, E-08 | US-008 / AC-008 | P0 | R1 | 004, 007, 013 | CRM API, UI |
| REQ-009 | Authorized close, reopen, skip, and outcome history | PARTIAL | E-07, E-08 | US-009 / AC-009 | P0 | R1 | 008, 012, 026, 042 | CRM API, QA |
| REQ-010 | Configurable pipelines, stages, and requirements | TO IMPLEMENT | E-01, E-08 | US-010 / AC-010 | P1 | R2 | 004, 009, 024 | CRM model, UI |
| REQ-011 | Validated process migration with historical snapshots | TO IMPLEMENT | E-01, E-07 | US-011 / AC-011 | P0 | R2 | 010, 026, 034 | CRM model, operations |
| REQ-012 | Consistent linked activity timelines | PARTIAL | E-09, E-10 | US-012 / AC-012 | P0 | R1 | 004, 007 | CRM API, UI |
| REQ-013 | Assigned tasks, priorities, rescheduling, and queues | PARTIAL | E-09, E-10 | US-013 / AC-013 | P0 | R1 | 004, 012 | CRM API, UI |
| REQ-014 | Local appointments and calendar views | TO IMPLEMENT | E-01, E-10, E-26 | US-014 / AC-014 | P1 | R2 | 013, 023 | Calendar API, UI |
| REQ-015 | Notes with revisions and author attribution | PARTIAL | E-09, E-10 | US-015 / AC-015 | P1 | R2 | 004, 012, 026 | CRM API, UI |
| REQ-016 | Private linked documents and file versions | TO IMPLEMENT | E-15 | US-016 / AC-016 | P1 | R2 | 004, 026, 032 | Storage, API, UI |
| REQ-017 | Import mapping, validation, and read-only preview | TO IMPLEMENT | E-05, E-06, E-08, E-23 | US-017 / AC-017 | P1 | R2 | 005, 006, 010, 024 | Data migration, UI |
| REQ-018 | Repeatable import with row receipts and recovery | TO IMPLEMENT | E-01, E-23, E-24 | US-018 / AC-018 | P0 | R2 | 017, 026, 033 | Data migration, QA |
| REQ-019 | Authorized CSV and structured portability export | TO IMPLEMENT | E-05, E-06, E-07 | US-019 / AC-019 | P1 | R2 | 004, 016, 026 | Data migration, API |
| REQ-020 | Search, filters, saved views, and list recovery | PARTIAL | E-05, E-06, E-08, E-14 | US-020 / AC-020 | P1 | R2 | 004, 010, 024, 027 | CRM API, UI |
| REQ-021 | Reconciled counts and currency-safe totals | PARTIAL | E-11, E-12 | US-021 / AC-021 | P0 | R1 | 009, 023, 027 | Reporting, QA |
| REQ-022 | History reports, estimates, filters, and report export | PARTIAL | E-11 | US-022 / AC-022 | P1 | R2 | 010, 011, 019, 021 | Reporting, UI |
| REQ-023 | Supported currencies, local rates, locale, and timezone | PARTIAL | E-12 | US-023 / AC-023 | P0 | R2 | 004, 025 | Reporting, configuration |
| REQ-024 | Typed client field templates and validation | PARTIAL | E-01, E-13 | US-024 / AC-024 | P1 | R2 | 004, 026 | Configuration API, UI |
| REQ-025 | Client branding and credential-free profiles | PARTIAL | E-04, E-26 | US-025 / AC-025 | P1 | R2 | 001, 016, 024 | Configuration, UI |
| REQ-026 | Attributable protected business and admin audit | PARTIAL | E-01, E-07 | US-026 / AC-026 | P0 | R1 | 001 | API, governance |
| REQ-027 | Archive, restore, elevated purge, and private retention | PARTIAL | E-05, E-06, E-16 | US-027 / AC-027 | P0 | R2 | 004, 016, 026, 036 | CRM API, operations |
| REQ-028 | Explicit optional AI enablement and graceful absence | PARTIAL | E-17, E-29, E-32 | US-028 / AC-028 | P2 | R5 | 004, 031, 036 | Agent, configuration |
| REQ-029 | Scoped, sourced, reviewable AI with limits | PARTIAL | E-01, E-17 | US-029 / AC-029 | P2 | R5 | 026, 028, 043 | Agent, QA |
| REQ-030 | Optional scoped connections and private scheduling | PARTIAL | E-16, E-18, E-19 | US-030 / AC-030 | P2 | R5 | 004, 026, 031, 036, 043 | Integrations, operations |
| REQ-031 | No default external transmission or background dependency | PARTIAL | E-13, E-16, E-22, E-29, E-32 | US-031 / AC-031 | P0 | R1 | 032 | Privacy, API, agent |
| REQ-032 | Repeatable app, API, database, and storage package | PARTIAL | E-19, E-20, E-31, E-34 | US-032 / AC-032 | P0 | R3 | 037 | Operations, architecture |
| REQ-033 | Consistent private backup and proven restoration | TO IMPLEMENT | E-19 | US-033 / AC-033 | P0 | R3 | 001, 016, 032 | Operations, QA |
| REQ-034 | Versioned upgrade and recovery-compatible rollback | TO IMPLEMENT | E-19, E-20 | US-034 / AC-034 | P0 | R3 | 032, 033 | Operations, CRM model |
| REQ-035 | TLS, trusted origins, and private data services | PARTIAL | E-02, E-19, E-23 | US-035 / AC-035 | P0 | R3 | 032, 037 | Operations, security |
| REQ-036 | Health, readiness, safe logs, and recovery actions | PARTIAL | E-16, E-19 | US-036 / AC-036 | P0 | R3 | 032 | Operations, API |
| REQ-037 | Credentials, sessions, rate limits, and recovery controls | PARTIAL | E-02, E-19, E-23 | US-037 / AC-037 | P0 | R3 | 026 | Identity, security |
| REQ-038 | Accessible localized complete internal workflow | PARTIAL | E-26 | US-038 / AC-038 | P1 | R2 | 004, 014, 016, 023 | UI, QA |
| REQ-039 | Measured capacity and explicit operator acceptance profile | TO IMPLEMENT | E-19, E-25 | US-039 / AC-039 | P0 | R3 | 021, 032, 036 | Performance, operations |
| REQ-040 | Reproducible MIT delivery and proposed service offer | PARTIAL | E-20, E-23 | US-040 / AC-040 | P1 | R4 | 032, 033, 034, 038 | Release, product |
| REQ-041 | Implementation, training, ownership, and actual acceptance | TO IMPLEMENT | E-23 | US-041 / AC-041 | P1 | R4 | 019, 033, 040, 042 | Product, implementation |
| REQ-042 | Operational handoff and linked renewal without ERP claims | TO IMPLEMENT | E-07, E-09, E-23 | US-042 / AC-042 | P1 | R2 | 008, 012, 013 | CRM API, product |
| REQ-043 | Scoped, expiring, revocable API keys | PARTIAL | E-01, E-02, E-21 | US-043 / AC-043 | P0 | R3 | 003, 004, 026 | Identity, API |
| REQ-044 | Two independent client installations and recovery rehearsal | TO IMPLEMENT | E-01, E-19 | US-044 / AC-044 | P0 | R4 | 001, 033, 034, 040 | Release, operations, QA |

## Dependency interpretation

The matrix lists capability dependencies, not an instruction to complete each whole requirement serially.
R1 uses initial increments of packaging, currency, files, handoff, and lifecycle requirements.
R2 and R3 complete those requirements through their final acceptance gates.

The implementation order separates contracts from capability completion.
Establish the single-instance contract, audit foundation, and permission policy first.
Create local access and minimal packaging next.
Then validate the complete commercial path.
Add configured stages, data portability, files, and calendar after that baseline works.
Prove recovery and distribution before enabling external capability.

## Verification receipt fields

Each scenario receipt contains requirement ID, scenario ID, revision, date, environment, synthetic dataset, actor role, and observed assertions.
It also contains command or manual path, actual output reference, result, and unresolved issues.
Status changes require a receipt.
A failed scenario keeps the requirement PENDING or records a proven failure.
A release summary never overwrites individual failed assertions.

No source inspection, team assignment, or unit-test count changes complete runtime acceptance from PENDING.
Optional enabled AI work remains R5. Its disabled-state behavior remains mandatory before the first installation.

## 2026-10-03 partial identity evidence

REQ-002/003/004/026/037/043 receive bounded identity evidence, not full scenario acceptance.
The managed identity harness applies all 59 checked-in migrations to an empty disposable PGlite database.
It checks active membership, controlled provisioning, last active owner, suspension, role changes, password reset, and append-only audit.
The HTTP fixture checks authentication, strict identity input, human-session-only configuration, revocation, and privilege denials.
The fixture loads workspace and key routers, not the complete application or REST bridge.
Three-role enforcement never accepts five-role policy, invitations, scoped grants, or business reassignment.
PostgreSQL 17, browser, clean Linux installation, recovery, and 44 full scenarios remain pending.

## Issues

1. NOT DONE — Every runtime scenario in this matrix remains pending.
   Fix: attach execution receipts to the numbered acceptance scenarios.
