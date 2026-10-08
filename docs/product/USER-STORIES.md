# User stories and acceptance scenarios

Updated: 2026-10-02. Pilot context: [Corporativo S&F](PILOT-CORPORATIVO-SF.md).
Status: implementation backlog.
Execution status: every `AC-xxx` is PENDING.
The scenarios use isolated synthetic data and fresh local credentials.
Each scenario includes success, denial, or failure assertions.
The matrix assigns priority, dependency, source state, and release.
All people, process labels, and accounts in these scenarios are synthetic fixtures, not approved S&F business configuration.

## Installation and users

### US-001 — Dedicated company installation

As a client operator, I need a separate instance that protects my company's records.
Requirement: REQ-001. Scenario: AC-001.
Given two installations, each uses a distinct database, file root, secret set, and configuration profile.
When a user saves a record in installation A, installation B contains no matching record.
A user from A cannot authenticate to B with A's session.
Workspace routing never selects another installation's database.

### US-002 — Controlled local owner bootstrap

As an operator, I need to create the first owner without an external identity provider.
Requirement: REQ-002. Scenario: AC-002.
Given a fresh database and authorized local operator access, private provisioning creates the first protected owner.
When bootstrap completes, first-owner provisioning rejects reuse and public registration remains closed.
Concurrent bootstrap requests do not create uncontrolled additional owners.
Local sign-in, sign-out, and documented operator recovery work without provider credentials or SMTP.

### US-003 — User lifecycle

As an administrator, I need to create, invite, suspend, reactivate, and reassign internal users.
Requirement: REQ-003. Scenario: AC-003.
Given an active owner, user creation assigns only an authorized role.
Optional invitations expire and accept once; manual creation works without email delivery.
When a user is suspended, their sessions and keys lose protected access immediately.
Their business history remains, and their open work appears in a reassignment queue.
The system rejects last-owner suspension and unauthorized owner promotion.

### US-004 — Enforced corporate access

As a company owner, I need role and ownership rules on every business action.
Requirement: REQ-004. Scenario: AC-004.
Given owner, admin, manager, rep, and viewer fixtures, direct API requests follow the permission matrix.
When a rep edits another owner's record, the service denies the action without side effects.
Viewer writes fail through tRPC, REST, files, and bulk routes.
Bulk preview identifies unauthorized rows; applying explicitly authorized rows never changes denied rows.
UI visibility agrees with server authority.

## Commercial records and pipeline

### US-005 — Account lifecycle and duplicates

As a salesperson, I need to maintain prospects, customers, and partners with explicit ownership.
Requirement: REQ-005. Scenario: AC-005.
Given an account name and owner, creating an account works without a domain or website.
When a normalized domain matches an active account, duplicate review identifies the conflict.
Authorized lifecycle edits appear in history and filters.
A manager-controlled merge preserves contacts, opportunities, documents, and audit references.
The service never deletes a duplicate automatically.

### US-006 — Contact lifecycle

As a salesperson, I need accurate people records and duplicate review.
Requirement: REQ-006. Scenario: AC-006.
Given a person's name, creation works with no email address.
When normalized email matches an active contact, the system displays an explicit conflict.
Edits retain name, phone, title, account, owner, and source.
An authorized merge preserves activities and opportunity links.
Shared mailbox input never generates invented people or inferred identities.

### US-007 — Account and buying relationships

As a salesperson, I need contacts with buying roles on the correct opportunity.
Requirement: REQ-007. Scenario: AC-007.
Given an account, its contacts, and an opportunity, attaching a contact records a role.
Repeated attachment preserves the existing role and creates no duplicate relation.
Detaching removes the relation while retaining the contact and history.
A cross-account contact fails the current primary-account consistency rule.
Changing the primary company triggers explicit relation review.

### US-008 — Complete opportunity record

As a salesperson, I need an opportunity that names its accountable person and next action.
Requirement: REQ-008. Scenario: AC-008.
Given an active account and owner, opportunity creation stores name, pipeline, stage, source, and commercial details.
Amount and expected close date remain unset until known.
Zero amount differs from an unknown amount.
Open opportunities display the next action or a missing-action warning.
An inactive owner or invalid account rejects the write.

### US-009 — Safe stage transitions

As a salesperson, I need stage changes with outcome evidence and preserved history.
Requirement: REQ-009. Scenario: AC-009.
Given an owned opportunity, a valid transition writes the new stage and one dated history event.
Lost and disqualified closure reject an empty reason.
Won closure requires configured evidence and creates a handoff task.
Reopen and skipped-stage actions require a reason and retain prior close events.
Repeated or concurrent requests never produce duplicate transition effects.

### US-010 — Client-configurable pipeline

As a sales manager, I need stage labels and rules that fit my company's process.
Requirement: REQ-010. Scenario: AC-010.
Given a pipeline template, the manager configures labels, order, required fields, and outcome classes.
Creating a second pipeline uses its own stage IDs.
Opportunities, lists, board, and reports use the selected pipeline consistently.
An opportunity cannot use a stage from another pipeline.
The service rejects invalid outcome configuration and missing terminal destinations.

### US-011 — Safe pipeline migration

As a manager, I need process changes that preserve opportunities and historical reporting.
Requirement: REQ-011. Scenario: AC-011.
Given stages with active opportunities, archive or removal first displays affected records and required mappings.
Applying a validated mapping changes current assignments and preserves historical label snapshots.
Legacy enum stages map to their original outcome classes.
An incomplete mapping, stale preview, or cross-pipeline destination rejects application.
Re-running a completed migration does not duplicate history.

## Activities, tasks, and documents

### US-012 — Complete record timeline

As a salesperson, I need a consistent history across an account and its commercial records.
Requirement: REQ-012. Scenario: AC-012.
Given related account, contact, and opportunity fixtures, creating an activity preserves author and occurrence time.
Linked timelines show the same activity once.
Note, call, manual email log, meeting, task, and stage-event filters return the correct entries.
Pagination neither skips nor duplicates entries.
Conflicting account and contact references reject the write.

### US-013 — Assigned tasks and follow-up

As a salesperson, I need my assigned work regardless of who creates it.
Requirement: REQ-013. Scenario: AC-013.
Given a manager-created task assigned to a rep, the task appears in that rep's queue.
The queue distinguishes overdue, upcoming, completed, and cancelled work.
Authorized rescheduling, reassignment, completion, and reopening preserve an event history.
The task links to its account, contact, or opportunity.
A rep cannot assign another person's work without the required permission.

### US-014 — Provider-independent calendar

As a salesperson, I need appointments and task deadlines without connecting a cloud calendar.
Requirement: REQ-014. Scenario: AC-014.
Given no provider connection, the user creates, edits, cancels, and views local appointments.
The calendar supports day, week, and month views with linked tasks and records.
Start, end, participants, timezone, and all-day state remain consistent after reload.
Invalid end times and ambiguous daylight-saving input produce explicit validation.
Local edits send no external invitation.

### US-015 — Auditable notes

As a salesperson, I need editable notes that retain their authors and previous content.
Requirement: REQ-015. Scenario: AC-015.
Given a note linked to a business record, authorized edits create dated revisions.
The latest revision appears in the timeline; revision history identifies its author.
Unauthorized edits fail without modifying the note.
Archive preserves revisions.
The user can distinguish a note from an AI suggestion or external message.

### US-016 — Private business documents

As a salesperson, I need proposals and evidence files attached to business records.
Requirement: REQ-016. Scenario: AC-016.
Given private persistent storage, upload stores metadata, checksum, uploader, and record links.
Authorized download returns the file after a fresh permission check.
Anonymous download and unauthorized purge fail.
New versions preserve prior metadata and history.
Invalid media types, configured size violations, interrupted uploads, and unavailable storage produce actionable errors.
Backup restoration recovers linked file content and verifies checksums.

## Portability, retrieval, and reports

### US-017 — Previewed import

As a migration administrator, I need a clear preview before importing spreadsheet records.
Requirement: REQ-017. Scenario: AC-017.
Given synthetic CSV files, preview maps columns, field types, sources, owners, stages, and associations.
The preview reports invalid rows, duplicate choices, missing relations, and planned changes.
UTF-8 names, quoted delimiters, date formats, blank values, and unknown currencies receive explicit handling.
Preview changes no business records.
Restricted users cannot apply the import.

### US-018 — Repeatable import application

As a migration administrator, I need imports that recover without duplicating successful work.
Requirement: REQ-018. Scenario: AC-018.
Given an approved preview, application processes accounts, contacts, opportunities, then associations.
Each row records source identity, result, and error status.
Interrupting and resuming the job preserves successful rows and relation consistency.
Reapplying the same source file uses the declared duplicate policy.
A stale preview or changed mapping requires another preview before application.
Corrected failed rows retry without replaying unrelated rows.

### US-019 — Controlled export and exit

As a company owner, I need to retrieve my business data without a vendor account.
Requirement: REQ-019. Scenario: AC-019.
Given an export grant, filtered CSV contains only requested authorized records and declared columns.
The CSV prevents spreadsheet formula execution from user-controlled text.
Structured export preserves IDs, relations, field definitions, stage history, notes, and document manifests.
The portability package excludes authentication secrets, provider tokens, and password hashes.
Each export has an audit event and a private expiry policy.
A fresh import rehearsal reconciles exported business records.

### US-020 — Search and saved views

As a salesperson, I need reusable record lists with stable search and filter behavior.
Requirement: REQ-020. Scenario: AC-020.
Given records across owners and stages, search, sort, filters, pagination, and archived views return consistent rows.
Saving a personal view preserves the selected state after reload.
An authorized shared view appears to other members without expanding their access.
A copied URL reproduces list state.
Removing a configured field or stage produces a clear view-repair message.

### US-021 — Reconciled commercial totals

As a manager, I need pipeline and outcome totals with disclosed calculation rules.
Requirement: REQ-021. Scenario: AC-021.
Given a hand-calculated synthetic dataset, counts and amounts reconcile with visible detail rows.
Default totals exclude archives, terminal opportunities from open value, and invalid converted amounts.
Missing rates display exclusion counts.
Win rate uses the declared denominator; an empty denominator displays no rate.
Report scope, period, currency, and calculation time remain visible.

### US-022 — Trends and estimated forecast

As a manager, I need filters and history-based reports that support commercial review.
Requirement: REQ-022. Scenario: AC-022.
Given known stage history, reports show stage age, conversion, close outcomes, activity, and owner workload.
Forecast uses only explicitly configured probabilities and labels its amounts as estimates.
Missing probabilities remain visible exclusions.
Changing pipeline, owner, or period updates detail rows and totals consistently.
Authorized report export matches displayed calculations.

### US-023 — Currency, locale, and time correctness

As an administrator, I need explicit regional settings and honest multi-currency reports.
Requirement: REQ-023. Scenario: AC-023.
Given a selected locale, timezone, and supported reporting currency, dates and amounts use those settings.
Manual rates support operation without an external rate feed.
Frozen rates retain original amounts; missing rates never become zero values.
Currency changes disclose recalculation and produce an audit record.
MXN fixtures pass only after MXN support exists.
Unsupported currencies fail clearly without substitution.

## Administration and optional services

### US-024 — Client field templates

As an administrator or manager, I need typed fields that follow my company's process.
Requirement: REQ-024. Scenario: AC-024.
Given a template, authorized users add, order, require, archive, and restore typed fields and options.
Values render in record sheets, selected table columns, filters, import, and export.
Invalid type changes identify affected values before migration.
New fields default to manual entry while AI remains disabled.
Unauthorized configuration writes fail through direct API requests.

### US-025 — Client identity and configuration profile

As a client administrator, I need company branding and configuration without a separate code fork.
Requirement: REQ-025. Scenario: AC-025.
Given synthetic company settings, name, private logo, labels, locale, and profile persist after restart.
Profile export contains templates and settings without business records or credentials.
Applying the profile to a clean instance creates the same process and fields with fresh instance identifiers.
The UI uses shared components and preserves readable contrast and attribution notices.
Missing optional logo or website does not block operation.

### US-026 — Business and administration audit

As an owner, I need attributable changes for review and support.
Requirement: REQ-026. Scenario: AC-026.
Given record edits, role changes, imports, exports, transitions, and configuration edits, each creates an audit event.
Events identify actor, action, record, time, correlation, and safe change metadata.
Business users cannot edit audit records.
Queries follow audit permissions and configured retention.
Logs and audit metadata exclude passwords, tokens, cookies, and unnecessary document content.

### US-027 — Archive, restoration, and purge

As a manager, I need reversible archive and controlled permanent removal.
Requirement: REQ-027. Scenario: AC-027.
Given linked business records, archive hides them from default lists and report totals while preserving history.
Restore checks active uniqueness and association conflicts.
Purge preview names dependent records and file effects.
Only an authorized actor or declared retention job applies purge.
Retention runs on a private-server scheduler without requiring Vercel.
The operation records results and handles partial storage cleanup visibly.

### US-028 — Optional AI capability

As a company owner, I need AI to remain inactive until I authorize it.
Requirement: REQ-028. Scenario: AC-028.
Given no AI configuration and no agent process, the complete local sales path works.
The UI states that AI is disabled without showing failed background runs.
Enablement names provider, transmitted data classes, scope, and configured budget before a run.
Missing or revoked credentials disable the capability gracefully.
Provider failure never blocks ordinary record work.

### US-029 — Reviewable AI suggestions

As a salesperson, I need sourced suggestions that preserve human control over customer records.
Requirement: REQ-029. Scenario: AC-029.
Given enabled AI and approved record scope, the agent returns evidence-linked suggestions as proposals.
The user accepts or rejects each proposal with an audit event.
AI cannot silently overwrite human values, close deals, export records, or send messages.
The system records run status, inputs by safe reference, configured limits, and observed cost when available.
Cancellation, denied scope, missing evidence, and budget exhaustion produce explicit terminal states.

### US-030 — Optional external connections

As an administrator, I need connections that declare their data access and action authority.
Requirement: REQ-030. Scenario: AC-030.
Given disconnected providers, local login, tasks, calendar, and documents remain usable.
Connecting a provider displays its read scope, send scope, data classes, destination, and consent status.
Scheduled jobs use private-server scheduling and repeatable event identities.
Revocation stops future jobs and removes application access to the credential.
External sends require explicit authority and never occur from a manual log or local appointment alone.

### US-031 — Default local privacy

As a company owner, I need the default installation to keep its business data inside the instance.
Requirement: REQ-031. Scenario: AC-031.
Given a fresh installation and denied external egress, the core path completes without external requests.
Telemetry, favicon lookup, image fetching, research, provider sync, and external rate refresh remain disabled.
Optional services show disabled state instead of retry loops.
Enabling a capability identifies transmitted fields and requires explicit company authority.
Credential removal never re-enables an upstream default.

## Operation and commercial delivery

### US-032 — Installable private-server package

As an operator, I need a documented package that starts the CRM on a clean supported server.
Requirement: REQ-032. Scenario: AC-032.
Given documented prerequisites, installation starts application, API, dedicated database, and private persistent storage.
The agent starts only through an explicit optional profile.
Initialization applies required migrations once and checks service readiness.
Ports, volumes, service names, and limits derive from the instance profile.
Restart preserves data and supports two instances without naming or port collisions.

### US-033 — Backup and restoration

As a client operator, I need to recover business records and private files after server failure.
Requirement: REQ-033. Scenario: AC-033.
Given synthetic business data, a backup covers database, files, and required configuration references.
The backup protects access and records version, time, checksums, and consistency method.
Restore into a clean isolated instance recovers records, relations, history, and matching file checksums.
The operator records actual backup and recovery duration.
Missing or incompatible backup inputs fail clearly without altering the source installation.

### US-034 — Controlled upgrade and rollback

As an operator, I need version changes that preserve recoverable business data.
Requirement: REQ-034. Scenario: AC-034.
Given a supported previous version, preflight validates compatibility and a recoverable backup.
Upgrade applies versioned migrations and completes the commercial smoke path.
A failed upgrade produces a diagnostic and documented restoration path.
Destructive schema changes explicitly require restoring the matching backup and previous artifacts.
The runbook never promises an unsupported automatic database downgrade.

### US-035 — Private production network access

As an operator, I need authenticated encrypted browser access with private data services.
Requirement: REQ-035. Scenario: AC-035.
Given a private-server topology, browser access uses configured TLS and trusted origins.
Cookies use the production security settings.
Database and storage management ports remain inaccessible from the public network.
Forwarded-host handling, session expiry, and rejected origins receive direct request tests.
Public registration and unauthenticated business routes remain closed.

### US-036 — Operational visibility

As an operator, I need useful health, error, storage, and job information.
Requirement: REQ-036. Scenario: AC-036.
Given running services, health distinguishes liveness, database readiness, storage readiness, and optional capability state.
Logs include correlation identifiers without secrets or business bodies.
Failed migrations, exhausted storage, database loss, and stopped optional services produce actionable status.
Maintenance and restart procedures preserve data.
The package documents retention, job ownership, and operator recovery actions.

### US-037 — Safe sessions and credentials

As an owner, I need fresh credentials and protected local authentication.
Requirement: REQ-037. Scenario: AC-037.
Given new installation secrets, password storage never contains plaintext passwords.
Failed authentication receives rate limiting and safe error responses.
Session logout, expiry, suspension, and secret rotation invalidate access as documented.
Configuration templates contain no working secrets.
Recovery, CSRF, authorization, and dependency checks include negative cases before production acceptance.

### US-038 — Usable internal interface

As an internal user, I need clear record work in the configured language and accessible controls.
Requirement: REQ-038. Scenario: AC-038.
Given the client locale, the main commercial path displays consistent terms, dates, labels, and actionable errors.
Keyboard use reaches forms, tables, dialogs, task actions, and calendar controls.
Forms retain entered values after validation errors.
Loading, empty, disabled, failure, and narrow-screen states remain understandable.
Private internal pages do not display public SaaS signup or billing flows.

### US-039 — Evidence-based capacity

As an operator, I need installation sizing based on measured workload.
Requirement: REQ-039. Scenario: AC-039.
Given a declared synthetic workload and selected server profile, tests record volume, concurrency, latency, and resource use.
List, search, report, import, and file operations receive measurements.
The operator compares results with an explicit acceptance profile before production approval.
Unspecified capacity targets remain pending.
No test result becomes an invented commercial service guarantee.

### US-040 — MIT-compatible delivery kit

As a delivery team, I need a reproducible package with clear software and service boundaries.
Requirement: REQ-040. Scenario: AC-040.
Given a release candidate, the kit includes artifacts, source references, MIT notice, dependency notices, and checksums.
It includes configuration templates, prerequisites, release notes, import templates, and operational runbooks.
No activation server or subscription check blocks local data access.
The proposal identifies services separately from the existing MIT rights.
Prices, legal identity, and contract commitments remain unset until the business owner approves them.

### US-041 — Client implementation and handover

As a client owner, I need training, operational responsibility, and reviewable acceptance evidence.
Requirement: REQ-041. Scenario: AC-041.
Given an agreed implementation scope, handover names deliverables, data mapping, configuration, operators, and support access.
A synthetic rehearsal demonstrates the complete sales path and recovery procedure.
The owner receives administrator control, export instructions, and a support revocation procedure.
Acceptance records observed criteria and the actual human decision.
The kit never pre-fills acceptance, supplier identity, prices, or service guarantees.

### US-042 — Handoff, renewal, and system boundaries

As a manager, I need won opportunities to create accountable follow-up and later commercial work.
Requirement: REQ-042. Scenario: AC-042.
Given a won opportunity, the team records a delivery reference and assigned handoff task.
Account follow-up creates a linked renewal or expansion opportunity with independent outcome history.
The earlier opportunity retains its evidence and dates.
ERP references remain manual until an optional adapter receives authority.
No CRM stage asserts invoice issuance, payment receipt, legal signature, or completed service delivery.

### US-043 — Scoped API keys

As an administrator, I need programmatic access that respects the same rules as internal users.
Requirement: REQ-043. Scenario: AC-043.
Given an authorized key creator, issuance declares scopes, expiry, and owning identity.
The secret displays once and never appears in logs or later read responses.
Direct REST or tRPC requests obey action, owner, export, and current membership checks.
Revocation, expiry, and user suspension deny further access immediately.
Keys never receive owner privileges from a caller-supplied role or company identifier.

### US-044 — Repeated isolated delivery

As a delivery team, I need evidence that two clients receive independent installations from the same package.
Requirement: REQ-044. Scenario: AC-044.
Given two synthetic client profiles, the same version installs independently with fresh secrets and separate persistent resources.
Each instance completes the full commercial path and retains its own branding and records.
Backup and restoration for A never read or modify B's storage or database.
Updating A never applies B's migrations.
No shared instance directory, database, or vendor credential becomes a hidden dependency.

## Issues

1. NOT DONE — Acceptance scenarios specify required behavior without runtime execution receipts.
   Fix: the principal executes them against integrated releases and records each result.
