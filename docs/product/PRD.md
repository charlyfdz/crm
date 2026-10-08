# Product requirements document

Date: 2026-10-02.
Status: implementation specification within the approved product direction.
Acceptance status: PENDING.

## Problem and outcome

A company needs one reliable record of accounts, contacts, commercial opportunities, and follow-up work.
Its team needs configurable processes, controlled access, useful reports, and recoverable operation.
The company controls its data and server.
A delivery team needs repeatable packages and client configuration without maintaining separate code forks.

The target outcome covers installation, daily sales work, administration, recovery, updates, and delivery to another company.
Login enables this outcome but does not complete it.
No revenue, adoption, time-saving, or performance result is asserted.

## Approved first pilot

The user's 2026-10-02 decision names Corporativo S&F as the first operating client company.
The future deployment target is Coolify on `paas-control` inside homelab.
The user explicitly requires a complete version before installation.
The current task authorizes no server installation, network change, real-data import, or provider connection.

Homelab belongs to Personal — Carlos. The hosted pilot remains within Corporativo S&F's business boundary.
Hosting never transfers company data authority or establishes product legal ownership.
No company process, staff list, CRM domain, logo, supplier identity, or legal claim is inferred.
The [pilot contract](PILOT-CORPORATIVO-SF.md) records verified sources and outstanding company decisions.

## Product boundaries

- One installation contains one operating client company, one workspace, and one dedicated database.
- Many prospect and customer accounts exist inside that workspace.
- Each other operating client receives separate application configuration, database credentials, storage, secrets, and backups.
- The workspace slug identifies a route; it does not establish a tenancy boundary.
- PostgreSQL remains the source of business records.
- The application and API remain necessary services.
- The agent becomes an optional service.
- The core workflow works without Google, Microsoft, AI, hosted storage, external exchange rates, or upstream telemetry.
- The default installation contains no customer data, external credentials, or live integrations.
- Test environments use synthetic records and newly generated local credentials.

Shared SaaS billing, public registration, multi-company workspaces, and vendor access to customer databases are outside this product model.
Accounting, invoices, payments, inventory, legal contract execution, and helpdesk tickets remain external responsibilities.
The CRM records commercial evidence and handoff references for those responsibilities.

## People and vocabulary

| Term | Definition |
| --- | --- |
| Operating client company | The company that receives and operates one CRM installation. |
| Workspace | The singleton company profile and internal membership boundary. |
| Account | A prospect, customer, or partner business represented by `Company`. |
| Contact | A person represented by `Contact`. |
| User | An internal authenticated person represented by `User`. |
| Opportunity | A potential sale represented by `Deal`. |
| Opportunity owner | The user accountable for follow-up on one opportunity. |
| Workspace owner | A user with protected administrative authority. |
| Pipeline | An ordered commercial process with stable stage identifiers. |
| Activity | A dated note, call, email log, meeting, task, or stage event. |
| Document | A private business file with record links and controlled access. |
| Delivery operator | A person who installs or supports a client installation under delegated access. |

The authentication `Account` table contains provider credentials.
It is not a commercial account.

## Implementation defaults

These defaults permit implementation without further product discovery.
They do not establish prices, legal identity, production approval, or client acceptance.

| Decision | Default and effect |
| --- | --- |
| Company isolation | Separate database and storage namespace per installation. No runtime company switcher. |
| Authentication | Local email and password. Administrator creates users. Public registration remains closed. |
| First owner | Operator performs a controlled, one-time bootstrap. Concurrent requests never create uncontrolled owners. |
| Recovery | Operator uses a documented local recovery procedure. SMTP becomes an optional reset channel. |
| Roles | Owner, administrator, sales manager, salesperson, and viewer. See the permission catalogue. |
| Record visibility | All active internal roles read workspace business records. Salespeople modify their own records. |
| Company associations | One primary account per contact and opportunity. Multiple contacts belong to an opportunity. |
| Pipeline | Start with one configurable pipeline. Add multiple pipelines with the same stage model in R2. |
| Stage outcomes | OPEN, WON, LOST, and DISQUALIFIED remain stable classifications. Labels and ordering vary per client. |
| History | Stage events preserve stage labels and outcome snapshots. Renames never rewrite history. |
| Follow-up | Every open opportunity has an owner and a next action, or a visible missing-action warning. |
| Data lifecycle | Archive first. Restore explicitly. Purge requires elevated permission and dependency review. |
| Import | CSV first. Preview and explicit application precede database changes. |
| Export | Filtered CSV plus a structured portability package. Database backup remains a separate operator action. |
| Files | Private local persistent storage first. Optional private object storage uses the same access contract. |
| Calendar | Local tasks and appointments work without a provider. External calendars remain optional adapters. |
| Money | Preserve original amount and currency. Sum only valid converted amounts in the reporting currency. |
| Reporting | Show scope, period, currency, exclusions, and calculation rules. Forecast is an estimate. |
| Branding | Store client settings and assets. Keep one versioned codebase and shared UI components. |
| External access | Disable integrations, AI, telemetry, favicon lookups, and automatic external rate calls by default. |
| Operations | Support one server first. Document resource sizing from measured results. |
| Delivery | Ship source, versioned artifacts, notices, runbooks, configuration templates, and acceptance records. |

The pilot company name is confirmed. Users, locale, timezone, and supported reporting currency remain explicit client choices.
The client reviews those choices during candidate validation before installation.
The installer never assumes a real company identity or legal entity.
An unset locale, timezone, or reporting currency blocks completion with a clear configuration message.
The website is optional.
MXN support is a proposed R2 addition because the baseline currency catalogue excludes it.
The product never silently replaces an unsupported currency with USD.

## Domain and data rules

Account lifecycle uses prospect, qualified, customer, partner, inactive, and archived classifications.
Client templates select labels and optional fields.
Lifecycle describes the account relationship.
Pipeline stage describes an opportunity.
Record source describes intake provenance.
These values never substitute for each other.

Account domain and contact email remain optional.
Matching normalizes case and whitespace.
Active domain and email conflicts produce explicit duplicate review.
A restore operation also checks active uniqueness conflicts.
A merge operation preserves links and produces an audit record.
A shared mailbox never identifies two people automatically.

An opportunity requires a name, account, owner, pipeline, and stage.
Amount, currency, expected close date, next action, and commercial evidence follow stage requirements.
Unknown amount remains null.
Zero amount remains an explicit value.
Closing as lost or disqualified requires a reason.
Closing as won requires recorded commercial evidence and a handoff task.
Won represents an approved sales outcome; it does not assert payment or completed service delivery.

Tasks separate author from assignee.
Tasks have a due date, status, priority, and record reference.
Appointments have start, end, timezone, participants, and optional record references.
The system stores instants consistently and renders them in the selected timezone.
It validates daylight-saving transitions and date-only deadlines.

Notes preserve author, creation time, and edit history.
Documents preserve filename, media type, size, checksum, uploader, and linked records.
Downloads enforce the permissions of their linked records.
The system never exposes private files through permanent public URLs.

## Complete functional scope

The matrix specifies individual requirement IDs and delivery owners.
User stories specify acceptance assertions.

| Area | Requirement IDs | Required behavior |
| --- | --- | --- |
| Installation and access | REQ-001 through REQ-004 | Client boundary, owner bootstrap, user lifecycle, and enforced permissions. |
| Accounts and contacts | REQ-005 through REQ-007 | Account lifecycle, duplicate review, people, account links, and buying roles. |
| Opportunities and pipeline | REQ-008 through REQ-011 | Commercial data, transitions, configurable processes, and safe stage migration. |
| Follow-up | REQ-012 through REQ-015 | Activity timeline, assigned tasks, local calendar, and note history. |
| Documents and portability | REQ-016 through REQ-019 | Private files, previewed import, repeatable import, and controlled export. |
| Retrieval and reporting | REQ-020 through REQ-023 | Search, saved views, totals, trends, currencies, locale, and timezone. |
| Configuration and governance | REQ-024 through REQ-027 | Custom fields, client branding, audit, archive, restore, and purge. |
| Optional intelligence and connections | REQ-028 through REQ-031 | Explicit enablement, evidence, scoped adapters, and default privacy. |
| Operation | REQ-032 through REQ-039 | Installer, recovery, upgrades, network access, health, security, usability, and capacity. |
| Commercial implementation | REQ-040 through REQ-044 | MIT delivery, client handover, sales handoff, scoped API access, and isolation demonstration. |

## Reports and measurement

These definitions describe product calculations, not measured business results.

| Measure | Definition and exclusions |
| --- | --- |
| Open pipeline value | Sum valid `baseAmount` for active opportunities in OPEN stages within the selected scope. |
| Won value | Sum valid converted amounts for WON events inside the selected period. Reopen history remains visible. |
| Win rate | Won count divided by won plus lost count in the selected close period. Zero denominator produces null. |
| Disqualified count | Separate terminal classification. It never enters the default win-rate denominator. |
| Sales cycle | Elapsed time from opportunity creation to the selected close event. Reopened cycles remain identifiable. |
| Stage age | Elapsed time from the latest entry into the current stage. |
| Overdue tasks | Assigned incomplete tasks with due instants before the report instant. |
| Estimated forecast | Converted open amount multiplied by explicit configured probability. Missing probability produces an exclusion. |
| Conversion | Count stage transitions for a defined cohort. Stage history identifies repeated entries. |

Money reports show excluded counts and their reasons.
Archived records are excluded by default.
Historical reports use an explicit archived-record inclusion option.
Changing reporting currency requires a visible recalculation operation and an audit record.
Manual exchange rates permit local operation.

Measure release quality through linked scenario results, restoration receipts, authorization denials, and reproducible installation records.
Record latency, volume, resource use, backup duration, and recovery duration during controlled tests.
The operator selects capacity targets before production acceptance.
This document invents no target values or service guarantees.

## Proposed commercial delivery

The MIT notice remains in source and distributed substantial portions.
The commercial proposal charges for implementation, migration, customization, training, or support services.
It does not remove the client's MIT rights through technical activation controls.
No mandatory license server, call-home activation, per-seat lock, or subscription outage blocks local records.

The delivery package identifies version, upstream origin, local changes, dependency notices, and build instructions.
It includes reproducible artifacts, configuration profiles, import templates, recovery procedures, and upgrade compatibility.
The implementation statement identifies deliverables, exclusions, operator responsibilities, and acceptance evidence.
Prices, supplier legal identity, contract wording, support duration, and contractual guarantees remain business-owner decisions.
These decisions do not block core implementation or synthetic delivery rehearsals.

## Completion rule

R1 proves foundation increments of the local sales path. It is not the complete S&F pilot release.
R2 completes configurable professional CRM features.
R3 supplies operational production evidence.
R4 technical rehearsals prove repeatable delivery to isolated installations.
R5 supplies optional intelligence and integrations without weakening the local core.
The pre-installation candidate includes R1/R2 features, R3 technical evidence, and the specified R4 technical delivery rehearsals.
Recovery, permissions, security, capacity, and company review remain mandatory gates.
Passing unit tests or assembling Docker files never completes those gates.
The 44-requirement matrix retains complete runtime acceptance as PENDING.
Production approval and company review require separate human records before installation.
Final pilot acceptance requires post-installation evidence and the company's actual decision.
Unapproved prices and third-party contracts never block internal synthetic implementation.

## Issues

1. NOT DONE — The target product includes capabilities beyond the inspected baseline.
   Fix: implement requirements through the release gates.
2. UNKNOWN — Commercial terms and deployment capacity lack approved values.
   Fix: obtain those values before contractual delivery and production acceptance.
