# Local, production, and delivery acceptance

Updated: 2026-10-02.
Status: required acceptance plan.
Observed runtime acceptance: PENDING for all gates and scenarios.
Document inspection does not prove these gates.

## Corporativo S&F first-installation rule

The company and future Coolify target are confirmed in the [pilot contract](PILOT-CORPORATIVO-SF.md).
The user prohibits installation now. All current rehearsals remain isolated and local.
R1 or successful login never completes the first-installation candidate.
That candidate requires complete R2 features, R3 technical operating evidence, and R4 technical delivery rehearsals.
The pilot contract maps SF-01 through SF-08 to these gates and company review.

Pre-installation company review evaluates the demonstrated candidate and disclosed limits.
P-12 records future installation authority for the exact candidate, separate from test results.
Final pilot acceptance follows authorized installation checks and the company's actual user validation.
No acceptance record is pre-filled. Real-data import requires separate authority.

## Execution boundary

The principal installs dependencies and coordinates integration.
The QA or operations function executes these gates only inside its assigned authority.
Use a fresh isolated database and synthetic business records.
Generate credentials for the test instance.
Do not reuse existing environment files, customer data, or laboratory credentials.
Do not connect real external accounts during default local verification.
Provider tests require explicit authorization and dedicated test accounts.

Record the tested revision and configuration names without values that contain secrets.
Use safe output references rather than raw dumps or private logs.
Do not label deployment approved or client accepted without the actual human decision.

## Shared fixture and full commercial path

Create synthetic users for owner, admin, manager, two reps, and viewer.
Create synthetic accounts with and without domains.
Create contacts with and without emails, duplicate candidates, and conflicting associations.
Create opportunities in each outcome class with known dates, valid converted amounts, and missing-rate examples.
Create tasks with different authors and assignees.
Create archived records and duplicate restore conflicts.
Create private sample documents with checksums and harmless spreadsheet text.
Use reserved test domains and addresses such as `customer-a.example.test` and `rep-a@example.test`.

Complete this path with external egress denied:

1. Install a clean instance and bootstrap the owner.
2. Configure the company and create internal users.
3. Create an account, contact, and owned opportunity.
4. Record qualification, discovery, a note, and a follow-up task.
5. Create a local appointment and attach a private proposal file.
6. Change stages, close won, and complete a handoff task.
7. Create a second lost opportunity and record its reason.
8. Reopen an opportunity with a reason and retain earlier outcome history.
9. Reconcile reports and archive a record.
10. Preview and apply an import, then export and reconcile business records.
11. Restart the services and verify persistence.
12. Restore a backup into an isolated instance and verify business records and files.

R1 executes the existing-stage core path with initial private file and handoff increments.
R2 executes the entire path with configurable pipelines, calendar, import, export, and revisions.
R3 repeats the path from distributed production artifacts.
R4 repeats it across two independent synthetic client installations.

The company uses the complete path for candidate review, not the R1 subset.
Synthetic role fixtures do not identify S&F's actual staff or approved process.

## Local gates

| Gate | Required assertion | Evidence | Requirements |
| --- | --- | --- | --- |
| L-01 | Clean local startup creates only the dedicated synthetic instance. | Startup receipt, selected ports, readiness, instance profile, and fresh DB identity. | 001, 002, 032 |
| L-02 | Owner bootstrap, local login, logout, recovery, suspension, and last-owner protection work. | Positive and negative identity scenario results. | 002, 003, 037 |
| L-03 | Every role and ownership denial matches the permission catalogue. | Direct tRPC, REST, file, bulk, import, export, and key request assertions. | 004, 016, 019, 043 |
| L-04 | The complete sales path preserves associations, next actions, and outcome history. | Record and event assertions using synthetic fixture identifiers. | 005 through 016, 042 |
| L-05 | Local calendar and manual communication logs require no cloud connection. | Calendar and task results with external egress denied. | 012, 013, 014, 030 |
| L-06 | Import preview is read-only; retry and export preserve relations. | Before/after counts, row receipts, duplicate policy results, and portability reconciliation. | 017, 018, 019 |
| L-07 | Reports reconcile counts, periods, archive state, outcomes, and currency exclusions. | Hand-calculated fixture expectations and API/UI comparison. | 020, 021, 022, 023, 027 |
| L-08 | Client templates and branding persist without importing credentials. | Clean profile application and restart results. | 024, 025, 038 |
| L-09 | Missing AI, keys, providers, telemetry, favicon, and rate services never block the core. | Denied-egress observation and explicit disabled capability status. | 028, 030, 031 |
| L-10 | Backup restoration recovers files, relations, audit, and configuration references. | Restore receipt and checksum comparison. | 026, 033 |

Passing L-01 and L-02 alone never completes local product acceptance.
R1 acceptance uses the R1 scenario subset plus the stated initial increments.
R2 local acceptance requires every applicable local gate and R2 feature scenario.

## Production gates

These gates describe required evidence for a future production candidate.
They authorize no deployment in this specialist task.

| Gate | Required assertion | Evidence | Requirements |
| --- | --- | --- | --- |
| P-01 | Versioned artifacts install on a clean supported server with documented prerequisites. | Artifact checksums, dependency lock, supported platform, and clean installation receipt. | 032, 040 |
| P-02 | App, API, DB, and file readiness identify unavailable dependencies accurately. | Health results before and after controlled faults. | 032, 036 |
| P-03 | TLS, cookies, trusted origins, network exposure, and private storage enforce declared boundaries. | Topology, endpoint tests, port exposure results, and rejected-origin requests. | 035, 037 |
| P-04 | Controlled bootstrap, RBAC, user suspension, key scope, and privilege changes deny bypass requests. | Complete identity and permission negative-test receipts. | 002, 003, 004, 043 |
| P-05 | Database, files, and required configuration restore consistently into a clean instance. | Backup inventory, consistency method, restored counts, file hashes, and observed duration. | 016, 033 |
| P-06 | A supported prior version upgrades successfully and a forced failure follows documented recovery. | Before/after versions, schema checks, migration results, and restored commercial smoke path. | 011, 034 |
| P-07 | Logs and audit identify failures without leaking credentials or business bodies. | Redacted logging tests, sample safe events, retention, and operator access policy. | 026, 036, 037 |
| P-08 | Declared load meets the operator's selected acceptance profile. | Actual workload, server resources, observed latency, error counts, and signed target profile. | 039 |
| P-09 | Private jobs run without Vercel cron dependencies and expose failure state. | Retention scheduler results; enabled optional worker receipts only where authorized. | 027, 030, 036 |
| P-10 | Capacity, backup schedule, retention, recovery objectives, and operators have explicit values. | Operator-approved configuration record. No assumed values. | 027, 033, 036, 039 |
| P-11 | Dependency and application security checks resolve material release blockers. | Exact tool/version, scope, findings, fixes, and remaining approved limitations. | 037 |
| P-12 | Owner evaluates the complete candidate and records deployment authority separately from tests. | Actual decision, date, exact candidate, scope, and outstanding conditions. | 041 |

Production readiness requires applicable local gates and P-01 through P-11.
Pre-installation package tests use isolated supported environments, not the user's homelab.
Future admission also refreshes host evidence and obtains a dedicated quota under COR-522.
The 2.5 GiB/3.0 vCPU aggregate ceiling is not a CRM allocation or free capacity.
P-12 supplies human deployment authority.
Absent targets or unexecuted restoration keeps production acceptance pending.
No legal compliance, availability guarantee, or security certification is implied.

## Commercial distribution gates

| Gate | Required assertion | Evidence | Requirements |
| --- | --- | --- | --- |
| D-01 | The release contains MIT copyright, permission, dependency notices, source, artifacts, and checksums. | Package content review and source-to-artifact version mapping. | 040 |
| D-02 | One package installs twice with separate database, files, secrets, network configuration, and backups. | AC-044 receipt and A/B isolation checks. | 001, 032, 044 |
| D-03 | Client configuration imports without credentials or unrelated business records. | Profile schema, validation, and clean-instance replay. | 024, 025 |
| D-04 | Data migration has preview, duplicate policy, row results, recovery, and export reconciliation. | Client-mapping template and synthetic migration rehearsal. | 017, 018, 019 |
| D-05 | The handover includes sales training, administrator training, runbooks, operators, and access revocation. | Versioned checklist and completed synthetic rehearsal. | 033, 034, 038, 041 |
| D-06 | A proposed service offer distinguishes implementation and support from MIT software rights. | Reviewable offer template with unapproved commercial fields clearly blank. | 040, 041 |
| D-07 | Contractual prices, supplier identity, support obligations, and actual client acceptance have explicit approval. | Business-owner and client decisions with exact scope. | 040, 041 |
| D-08 | The client can export and operate its installation without a vendor account or activation service. | Local operation and exit rehearsal with external egress denied. | 019, 031, 040 |

R4 supplies a distribution candidate and synthetic delivery evidence.
The internal pilot candidate requires D-01 through D-05 and D-08 technical rehearsals.
The AC-041 rehearsal covers training, control transfer, and support revocation without asserting final company acceptance.
D-06 and D-07 commercial decisions precede a future commercial agreement. They never establish a prerequisite sale for this pilot.
Real commercial implementation also requires D-07 and separate execution authority.
This task prepares the documents and blank decision fields only.

## Receipt template

```text
Requirement and scenario:
Gate and release:
Exact revision and artifact version:
Execution date:
Environment and dedicated instance profile:
Synthetic fixture identifier:
Actor role and permission scope:
Command or complete manual path:
Expected assertions:
Observed assertions:
Safe evidence references:
Result: PENDING | PROVEN PASS | PROVEN FAIL
Issues and unresolved criteria:
Verifier:
Human acceptance or deployment decision: PENDING
```

This template contains no pre-filled success, verifier identity, or acceptance.
Keep raw sensitive evidence outside product documents.

The historical 49-test report and latest 95-test/static-check handoff remain partial evidence in [BASELINE.md](BASELINE.md).
They complete no gate and no full requirement acceptance.

## Issues

1. NOT DONE — Local, production, and distribution execution receipts remain pending.
   Fix: execute release-specific gates and attach evidence.
2. UNKNOWN — Operator capacity and recovery targets lack selected values.
   Fix: select and document the target profile before production acceptance.
