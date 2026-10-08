# Complete sales workflow

Updated: 2026-10-02. Pilot context: [Corporativo S&F](PILOT-CORPORATIVO-SF.md).
Status: target product specification.
Source state: [BASELINE.md](BASELINE.md).
Acceptance state: PENDING.

## Goal

An internal team manages a commercial relationship from intake through closure, handoff, and renewed follow-up.
The team keeps customer evidence inside its own installation.
The team works without AI or external accounts.

## Original inspected flow — 2026-10-01

This tree describes original baseline source behavior before the later working-tree changes.
It does not describe a verified runtime session.

```text
Internal person signs in
└─ Social provider or OIDC creates a session
   └─ Workspace enrollment assigns owner, admin, or member
      └─ Website and research-key onboarding gates precede normal navigation
         └─ Person creates a company
            ├─ Company creation queues agent work and favicon lookup
            ├─ Person adds contacts with one company link
            └─ Person creates a deal with a company and owner
               ├─ Person selects a fixed DealStage value
               ├─ Person records notes, calls, meetings, or tasks
               ├─ Tasks appear through their author's user filter
               ├─ Stage changes create timeline events
               └─ Dashboard aggregates deals and activities
```

The original flow couples access to upstream onboarding assumptions.
The target removes those couplings and preserves existing business records.
The baseline addendum records partial local access, telemetry, and AI-policy changes without certifying an integrated replacement flow.

## Target flow

```text
Operator installs a dedicated client instance
└─ Operator provisions the first owner through controlled local tooling
   └─ Owner selects company profile, users, roles, locale, timezone, and currency
      └─ Manager selects pipeline and client field template
         └─ Team captures an account and contact
            ├─ Manual intake
            ├─ Reviewed CSV import
            └─ Optional authorized integration intake
               └─ Team reviews duplicates and assigns ownership
                  └─ Salesperson qualifies the need and buying relationship
                     ├─ Disqualified: record reason and optional later follow-up
                     └─ Qualified: create or link an opportunity
                        └─ Salesperson records discovery, next action, and value basis
                           └─ Salesperson prepares a proposal document
                              └─ Team records negotiation and decision evidence
                                 ├─ Lost: record reason and optional re-engagement task
                                 ├─ Won: record evidence and operational handoff task
                                 └─ Open: maintain next action and expected close date
                                    └─ Team reviews reports and overdue work
                                       └─ Manager records delivery reference and account follow-up
                                          └─ Renewal or expansion creates a linked new opportunity
                                             └─ Team archives inactive records under retention policy
```

## Step contract

| Step | Actor | Inputs | Result | Exception and recovery | Trace |
| --- | --- | --- | --- | --- | --- |
| 1. Establish the instance | Operator and owner | Fresh configuration and authorized local provisioning | Dedicated database, company profile, and protected owner | Failed initialization displays the failed step. Retry preserves completed steps. | REQ-001, REQ-002, REQ-032 |
| 2. Prepare the team | Owner or administrator | Internal users and role assignments | Active users with declared permissions | Suspension revokes sessions and keys. Ownership reassignment preserves business records. | REQ-003, REQ-004 |
| 3. Configure the process | Manager and administrator | Pipeline template, required fields, outcome classes | Versioned process with stable stage IDs | Stage removal requires migration preview and explicit mapping. | REQ-010, REQ-011, REQ-024 |
| 4. Capture a relationship | Salesperson or manager | Account name, contact details, provenance | Account, contact, source, and owner | Duplicate candidates display conflicting active records. Missing email or domain remains valid. | REQ-005, REQ-006, REQ-017 |
| 5. Qualify the need | Salesperson | Need, buying role, source, and next action | Qualification activity and lifecycle value | Disqualification requires a reason. The contact remains available for later follow-up. | REQ-007, REQ-012, REQ-042 |
| 6. Open an opportunity | Salesperson | Name, account, owner, pipeline, and stage | Owned opportunity with visible completeness state | Missing next action produces a warning. Missing amount remains null. | REQ-008, REQ-013 |
| 7. Perform discovery | Salesperson | Call or meeting outcome, participants, requirements | Dated activity, notes, and assigned next task | Invalid links or dates reject the write. Rescheduling preserves history. | REQ-012 through REQ-015 |
| 8. Prepare a proposal | Salesperson | Scope notes, private proposal file, and value basis | Versioned commercial evidence attached to the opportunity | Unsupported files or unavailable storage produce recoverable errors. | REQ-015, REQ-016, REQ-023 |
| 9. Negotiate | Salesperson and manager | Decision notes, revised files, and expected close date | Stage history and updated next action | Concurrent stage changes preserve one valid transition and an explicit conflict response. | REQ-009, REQ-011 |
| 10. Close won | Authorized salesperson or manager | Commercial evidence and handoff owner | WON event, close instant, linked evidence, and handoff task | Required evidence failure keeps the opportunity open and identifies missing fields. | REQ-009, REQ-042 |
| 11. Close lost or disqualified | Authorized salesperson or manager | Outcome and reason | Terminal event and optional follow-up task | Empty reason rejects closure. Existing notes and contacts remain. | REQ-009, REQ-027 |
| 12. Hand off | Manager | Delivery reference, contact, responsible person, and next action | Traceable handoff activity and task | Missing external system stays a manual reference. No invoice or payment is asserted. | REQ-042 |
| 13. Review performance | Manager or viewer | Period, pipeline, owner, and currency | Reconciled reports and disclosed exclusions | Missing exchange rates exclude money values with visible counts. | REQ-021 through REQ-023 |
| 14. Renew or expand | Salesperson | Prior opportunity and current need | New opportunity linked to prior commercial history | Reopening requires a reason. It never erases the earlier outcome event. | REQ-008, REQ-009, REQ-042 |
| 15. Retain or remove | Manager, administrator, or owner | Archive selection, policy, and impact preview | Restorable archive or audited purge | Active uniqueness conflicts block restore. Purge authority and retention policy govern removal. | REQ-026, REQ-027 |

## Starter pipeline proposal

These labels are a configurable starter template.
They are not approved company process evidence.
They do not describe S&F's confirmed process. The company reviews its configuration before the future installation decision.
The installer permits a client-specific replacement.

| Stage | Outcome class | Minimum exit evidence |
| --- | --- | --- |
| New opportunity | OPEN | Account, owner, initial need, and next action. |
| Qualified | OPEN | Qualification note and identified contact. |
| Discovery | OPEN | Requirements note and discovery activity. |
| Proposal | OPEN | Proposal document reference and explicit amount state. |
| Negotiation | OPEN | Decision contact, next action, and expected close date. |
| Won | WON | Commercial evidence and handoff task. |
| Lost | LOST | Closure reason and close instant. |
| Disqualified | DISQUALIFIED | Qualification reason and close instant. |

The product supports skipped stages with an authorized reason.
It supports reopening with an explicit reason and history event.
Probabilities start unset.
The system displays forecast exclusions until a manager configures probabilities.
No probability constitutes a business guarantee.

Legacy stage migration preserves their outcomes.
`CLOSED_WON` maps to WON.
`CLOSED_LOST` maps to LOST.
`UNQUALIFIED_TO_BUY` maps to DISQUALIFIED.
The remaining baseline stages map to OPEN.
The migration preserves original labels and creates no invented conversion history.

## Intake, files, and communication rules

Manual email logging records a communication event.
It does not send an email.
Proposal upload stores evidence.
It does not sign a contract or send the proposal externally.
Local appointment creation changes the CRM calendar only.
External invitations require an enabled adapter and separate sending authority.

Import review displays file columns, mapping, invalid rows, duplicate decisions, and resulting associations.
The importer applies accounts before contacts, then opportunities, then relation data.
The importer assigns an import identifier and preserves source record identifiers.
An interrupted import resumes without duplicating successful rows.
An export observes record permissions and records who requests it.

## Architecture boundaries

| Responsibility | Layer | Rule |
| --- | --- | --- |
| Detect invalid business transitions | Validation contracts and API services | Reject before business mutation. |
| Authorize business actions | Shared permission policy and API services | Check action, role, record scope, and active membership. |
| Persist commercial history | Database transaction through API services | Write record change, activity, and audit together. |
| Show validation and operation state | Application and shared UI | Render server results and actionable errors. |
| Store private documents | Storage adapter through authenticated API | Check permissions on upload and download. |
| Execute optional research | `apps/agent` | Operate only after installation enablement and scoped authorization. |
| Perform external sends | Enabled adapter with approved action | Require explicit destination, authority, retry identity, and audit. |
| Recover and upgrade the instance | Operator tooling and runbooks | Verify backup and compatibility before schema changes. |

## Existing implementation anchors

| Flow | Existing anchor | Adaptation and meaningful verification |
| --- | --- | --- |
| Access and profile | Baseline `ensureWorkspaceMembership`; later `provisionUser`; `WorkspaceService.update` | Treat baseline enrollment as historical. Complete controlled provisioning, optional website, and user lifecycle. Test concurrent bootstrap and revoked access. |
| Account and contact intake | `CompaniesService.create`, `ContactsService.create` | Preserve normalization. Add duplicate review and record permission checks. |
| Opportunity transitions | `DealsService.create`, `DealsService.setStage` | Replace enum coupling. Verify close, reopen, skip, and concurrent transition history. |
| People on opportunities | `attachContact`, `detachContact`, `setContactRole` | Preserve company consistency and idempotent links. |
| Follow-up | `ActivitiesService.create`, `myTasks`, `complete` | Add assignee and scheduling state. Verify reassigned tasks use the assignee's queue. |
| Reports | `DashboardService.summary`, currency conversion services | Exclude archives and invalid conversions. Reconcile report rows to fixture records. |
| Client fields and views | `FieldsService`, saved-view contracts | Restrict configuration and disable implicit agent fill. Verify profile portability. |
| General documents | Conversation attachment model | Add a separate business-document contract. Verify private file access and restoration. |

The [evidence catalogue](BASELINE.md) links these anchors to source files.
Stories and acceptance scenarios define desired behavior before implementation details.

## Decisions and assumptions

Use the existing account, contact, opportunity, activity, and field abstractions.
Add configured stage records and a general private document abstraction.
Keep one primary company link for the first complete product.
Do not adopt legacy many-to-many account proposals without a demonstrated client need.
Keep ERP handoff as evidence and tasks.
Do not implement invoice generation, payment collection, or a shared SaaS tenancy layer.
Unselected client labels and contract terms remain configuration or commercial decisions.
They do not block this flow's implementation.

## Issues

1. NOT DONE — The inspected flow lacks the complete target pipeline, calendar, import, and document contracts.
   Fix: implement the linked requirements and execute the full path in R1 and R2.
