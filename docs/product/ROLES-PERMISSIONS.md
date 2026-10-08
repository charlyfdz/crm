# Roles and permission catalogue

Updated: 2026-10-04. Pilot context: [Corporativo S&F](PILOT-CORPORATIVO-SF.md).
Status: target policy for implementation.
Inspected baseline policy: owner, admin, and member exist for workspace administration.
General CRM mutations do not yet implement the complete corporate policy.
The full five-role policy below remains TO IMPLEMENT.
Focused opportunity, process, and task checks have local evidence. Full policy acceptance remains PENDING.

This catalogue defines the generic product target. It does not identify actual S&F users or approved business responsibilities.
The company's candidate review confirms privileged operators and record-read restrictions before real-user onboarding.
Existing local provisioning code does not establish enforcement of this complete permission catalogue.

## Current partial opportunity enforcement

The [2026-10-03 receipt](../verification/2026-10-03-opportunity-authorization.md) records this bounded increment.
The existing `member` role is not renamed to `rep` by this change.
No actual S&F identity or responsibility is assigned.

| Opportunity action | owner | admin | member |
| --- | --- | --- | --- |
| Read shared installation records | ALL | ALL | ALL |
| Edit, archive, restore, change contact links | ALL | ALL | OWN |
| Reassign to a current supported member | ALL | ALL | NO |
| Public permanent deletion after archive | ALL | NO | NO |

Unknown roles and missing memberships are denied. This includes `manager` and `viewer` until implemented.
Admin `GRANT`, first-owner recovery, and comprehensive business audit remain pending.
Trusted retention is a separate server path. Its local cutoff test does not accept a worker capability policy.
Other entity writers retain separate authorization work. This table does not establish company-wide acceptance.

## Current partial managed identity

The [managed identity receipt](../verification/2026-10-03-managed-identity.md) records three-role lifecycle checks.
Owners provision admins and members. Admins provision members only.
Owners manage elevated roles. Admins never modify owners or admins, or assign elevated roles.
Suspension, reactivation, administrative password reset, and role changes check current authority inside a locked transaction.
Suspension and role changes revoke sessions and disable all target-user keys.
Reactivation requires fresh login and never re-enables old keys.
The last active owner cannot be suspended or demoted.
Local administrative reset excludes the actor and requires an existing credential account.
Protected identity audit records successful changes without copying passwords or password hashes.
Audit rows reject ordinary SQL updates and deletes. Database operators retain database authority.
Managed identity and company-configuration mutations require human sessions, not API keys.
Company updates lock membership and configuration together, preserve metadata, and return the committed snapshot.
Company research remains a separate optional post-commit path. Enabled-AI atomic outbox acceptance remains pending.
Raw organization and API-key plugin HTTP endpoints are disabled. Internal SDK calls remain server-only.
Task selectors request active users. Historical record authorship remains unchanged after suspension.
The 30 disposable identity cases include real loopback Nest HTTP requests.
The 12 interface cases exercise policy and server-rendered controls, not a live browser.
Invitations, first-owner recovery, forced password change, business reassignment, scoped grants, and five-role migration remain pending.

## Current partial company and contact enforcement

The [company/contact receipt](../verification/2026-10-04-company-contact-authorization.md) records this bounded increment.
All sixteen company procedures and fifteen contact procedures forward the authenticated server identity.
Current active membership governs service reads and writes. Unknown and suspended roles fail closed.

| Company/contact action | owner | admin | member |
| --- | --- | --- | --- |
| Read shared installation records | ALL | ALL | ALL |
| Create records | ALL | ALL | OWN |
| Edit, archive, restore, request research, decide contact suggestions | ALL | ALL | OWN |
| Reassign or clear responsibility | ALL | ALL | NO |
| Public permanent deletion after archive | ALL | NO | NO |

Creation defaults responsibility to the actor. Assignment targets require active supported membership.
Members cannot claim unassigned records or transfer responsibility. Elevated actors can leave records unassigned.
Membership and record locks protect writes. Archived records reject edits and research requests.
Repeat archive preserves its first date. Bulk requests return individual success and denial results.
Company selectors exclude archived companies. Explicit null contact-company selection prevents automatic domain matching.
Primary contacts require active same-company contacts. Clear primary designation before moving or archiving the contact.
Existing opportunity-contact links prevent contact transfers. Detach links through their authorized opportunity operations first.
Contact restore requires an active linked company. Company purge requires archived child opportunities and locks those opportunities.
Public purge remains owner-only. Trusted retention uses private cutoff checks, not submitted actor or cutoff fields.
Manual research writes authorization, queue entries and status inside one transaction. Dispatch follows commit.
The queue fixture checks real task rollback with provider calls blocked. It does not execute an AI worker.
Automatic company research after creation or domain changes still needs an accepted transactional outbox.
UI controls, remaining writers, scoped keys, worker identities and the five-role policy remain incomplete.
These tests do not accept PostgreSQL concurrency or company-wide permissions.

## Roles

| Product role | Proposed stable key | Responsibility | Current mapping |
| --- | --- | --- | --- |
| Workspace owner | `owner` | Protect company control, appoint administrators, approve export and retention authority. | Existing role; target authority needs extension. |
| Administrator | `admin` | Manage users, client configuration, integration settings, and operations surfaces. | Existing role; target authority needs restrictions. |
| Sales manager | `manager` | Manage commercial work, pipeline rules, reassignment, and reports. | TO IMPLEMENT. |
| Salesperson | `rep` | Manage assigned accounts, contacts, opportunities, activities, and tasks. | Existing `member` requires migration to this role. |
| Viewer | `viewer` | Read business records and reports without writes or bulk extraction. | TO IMPLEMENT. |

New users receive `rep` only through administrator creation or an accepted invitation.
The owner approves migrations of existing privileged roles.
Existing members never receive manager or administrator authority automatically.
Only owners appoint owners or administrators.
Administrators manage manager, rep, and viewer assignments.
Administrators never alter an owner's role or suspend the last active owner.

## Permission semantics

- `ALL` permits the action across the installation's business records.
- `OWN` permits the action on a record assigned to the actor.
- `AUTHORED` permits note or activity edits by its author within an accessible record.
- `ASSIGNED` permits task edits by its assignee within an accessible record.
- `GRANT` requires a separate named, audited grant.
- `NO` denies the action.

Every active role reads business records across the workspace by default.
This default fits collaborative internal sales work.
It does not provide department or confidential-record isolation.
Customers requiring restricted reads need an explicit scope policy and acceptance cases before their implementation starts.
A saved view or owner filter never establishes a permission boundary.

Unassigned accounts and contacts remain readable but only manager, administrator, or owner assigns them.
Create operations assign the current salesperson unless an elevated actor selects another active user.
Each task separates author and assignee.
Its linked record also limits mutation authority.

## Permission matrix

| Permission | Owner | Admin | Manager | Rep | Viewer |
| --- | --- | --- | --- | --- | --- |
| `record.read` | ALL | ALL | ALL | ALL | ALL |
| `account.create`, `contact.create`, `deal.create` | ALL | ALL | ALL | OWN | NO |
| `account.update`, `contact.update`, `deal.update` | ALL | ALL | ALL | OWN | NO |
| `record.reassign` | ALL | ALL | ALL | NO | NO |
| `deal.transition`, `deal.close`, `deal.reopen` | ALL | ALL | ALL | OWN | NO |
| `activity.create` | ALL | ALL | ALL | OWN | NO |
| `activity.update`, `note.revise` | ALL | ALL | ALL | AUTHORED | NO |
| `task.create` | ALL | ALL | ALL | OWN | NO |
| `task.update`, `task.complete` | ALL | ALL | ALL | ASSIGNED | NO |
| `task.assign.other` | ALL | ALL | ALL | NO | NO |
| `calendar.create`, `calendar.update` | ALL | ALL | ALL | OWN | NO |
| `document.read` | ALL | ALL | ALL | ALL | ALL |
| `document.upload`, `document.addVersion` | ALL | ALL | ALL | OWN | NO |
| `document.archive` | ALL | ALL | ALL | OWN | NO |
| `record.archive`, `record.restore` | ALL | ALL | ALL | OWN | NO |
| `record.purge`, `document.purge` | ALL | GRANT | NO | NO | NO |
| `record.merge` | ALL | ALL | ALL | NO | NO |
| `pipeline.manage` | ALL | ALL | ALL | NO | NO |
| `pipeline.migrate` | ALL | ALL | ALL | NO | NO |
| `field.manage`, `template.manage` | ALL | ALL | ALL | NO | NO |
| `branding.manage`, `locale.manage` | ALL | ALL | NO | NO | NO |
| `currency.manage`, `rate.manage` | ALL | ALL | GRANT | NO | NO |
| `view.personal.manage` | OWN | OWN | OWN | OWN | OWN |
| `view.shared.manage` | ALL | ALL | ALL | NO | NO |
| `report.read` | ALL | ALL | ALL | ALL | ALL |
| `report.export`, `record.export` | ALL | GRANT | GRANT | NO | NO |
| `import.preview`, `import.apply` | ALL | ALL | GRANT | NO | NO |
| `member.create`, `member.suspend` | ALL | LIMITED | NO | NO | NO |
| `role.assign.managerRepViewer` | ALL | ALL | NO | NO | NO |
| `role.assign.ownerAdmin` | ALL | NO | NO | NO | NO |
| `connection.manage`, `ai.configure` | ALL | ALL | NO | NO | NO |
| `ai.requestSuggestion`, `ai.acceptSuggestion` | ALL | ALL | ALL | OWN | NO |
| `external.send` | GRANT | GRANT | GRANT | GRANT | NO |
| `apiKey.manage.self` | OWN | OWN | GRANT | NO | NO |
| `audit.read` | ALL | ALL | GRANT | NO | NO |
| `retention.manage` | ALL | GRANT | NO | NO | NO |
| `operation.status.read` | ALL | ALL | NO | NO | NO |

`LIMITED` excludes owners and privileged role promotion.
`GRANT` identifies actor, permission, scope, expiry, issuer, and revocation.
Owner grants never replace required client consent for external transmission.
Document download is a single-record read.
Bulk document extraction requires export permission.

## Operational identities

The server operator controls database and storage access outside application roles.
Application RBAC never conceals data from that operator.
The client assigns operator authority through its own operational arrangement.
The product records delegated support access, start, end, and revocation.
The product never creates permanent vendor access automatically.

Backup, restore, upgrade, and local recovery use dedicated operator procedures.
Those procedures do not expose raw database credentials through application pages.
An application administrator does not automatically receive server or database access.

AI and integration workers receive separate capability identities.
Their permissions never exceed the initiating user's permissions or the approved scheduled scope.
A service identity cannot appoint users, export the database, purge records, or enable other integrations.
API keys carry explicit scopes, expiry, and revocation state.
The service checks current user status and grants on each request.

## Enforcement requirements

The shared policy defines permission names and role mappings.
API entry points check the action and active membership.
Business services check ownership and linked-record consistency before mutation.
Transactions preserve authorization against concurrent reassignment or role changes.
The UI uses the same policy to explain available actions.
API enforcement remains authoritative.

Apply the policy to tRPC, REST bridges, uploads, downloads, bulk actions, imports, exports, and background work.
Change events retain actor and affected record identifiers.
Suspension and demotion revoke sessions and API keys or invalidate cached authority immediately.
Unknown roles and missing memberships deny protected operations.
At least one active owner remains.

## Required negative cases

| Scenario | Expected result | Trace |
| --- | --- | --- |
| Viewer calls a write endpoint directly | Permission denial. No business row, file, or side effect changes. | AC-004 |
| Rep edits another rep's opportunity | Permission denial despite a visible record or copied URL. | AC-004 |
| Rep submits a mixed-owner bulk request | Entire authorization preview identifies denials. Application changes only explicitly authorized selected rows. | AC-004 |
| Admin promotes themselves to owner | Permission denial and audit event. | AC-003 |
| Concurrent requests remove the last owner | At least one active owner remains. | AC-002, AC-003 |
| Suspended user reuses a cookie or API key | Protected access fails immediately. | AC-003, AC-043 |
| Key holder requests an undeclared export | Permission denial despite a valid key. | AC-019, AC-043 |
| Rep changes an assignee to another person | Permission denial without elevated assignment permission. | AC-013 |
| Document URL bypasses record checks | Anonymous access fails. Authenticated access follows record permission checks. | AC-016 |
| Scheduled AI requests excessive scope | Run refuses the scope and records the denial. | AC-029 |
| Support delegation expires | Application access and operational delegation close according to their separate procedures. | AC-041 |

## Issues

1. NOT DONE — The baseline does not enforce this corporate permission catalogue.
   Fix: integrate the policy and execute direct API denial tests.
2. RISK — Workspace-wide read access exposes all internal business records to active roles.
   Fix: disclose this default and implement restricted read scopes before clients require them.
