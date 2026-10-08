# API Rules

## Logging

`apps/api/src/logging`. `new Logger(Thing.name)` picks up `ContextLogger`. **Never
`console.log`.** Format follows `NODE_ENV` and is not configurable.

- **One object, not extra arguments** — `logger.log({ message: "Saved", userId })`;
  Nest prints a line per argument.
- **Errors pass the stack second** — `logger.error({ message }, err.stack)`. Passing
  the error object drops the trace.
- **Never log headers, query strings, or bodies** — cookies and personal data.
- **`LoggingModule` stays first in `AppModule`'s imports**, and Better Auth routes log
  via its own `middleware` option — it mounts before `MiddlewareConsumer`, so
  `/api/auth/*` never reaches ours.
- `requestId` from `RequestLoggerMiddleware` via `AsyncLocalStorage`;
  `UserContextInterceptor` adds `userId`. Prisma statements are opt-in
  (`PRISMA_LOG_QUERIES`).

## Intelligence never lives in the API

The API serves HTTP, auth, tRPC and the mailbox sync. It does **not** research, enrich,
score, summarise, match identities or decide anything about a person or company — not
as a fallback, not behind a flag. That is the eve agent in `apps/agent`, which owns
the vendor clients, the confidence model and the writes.

Nest's half is to report *that something happened*: `AgentTriggerService` writes an
`AgentTask` row. A row, not an HTTP call — the agent already leases from that table,
so the row survives the agent being down.

About to add a vendor client to `apps/api`? You want `apps/agent/agent/lib`. One
documented exception, for timing: the exchange-rate fetcher, below.

## One organization, and it is not a tenancy boundary

Single tenant. No org header, no org interceptor, no org-scoped cache keys, **no
`organizationId` on any CRM record.**

A **singleton workspace** exists — Better Auth's `organization` plugin, one row with
id `WORKSPACE_ID` (the literal `workspace`, in `@crm/db`, re-exported by `@crm/auth`
so the agent needn't depend on it). It answers only: what are we called, who works
here, what do we sell.

- **The id is a constant, never a parameter.** A function taking an `organizationId`
  has turned the plugin into tenancy plumbing.
- Public registration is closed. An operator provisions the first owner on an empty installation.
- Provisioning creates the account, credential and membership in one locked transaction.
- Login requires an existing membership and an eligible email. Login never creates membership or promotes an owner.
- `ensureWorkspaceMembership` remains legacy code. The login hook does not call it.
- **Permissions come from `@crm/auth`** — `canRenameWorkspace`, `canChangeRole`,
  `canConfigureSso`, `canManageCurrency` — enforced by the service *and* used to
  disable the UI control, so the button and the 403 cannot disagree.
  `WorkspaceService` protects the last active owner from demotion and suspension.
  Identity changes share the provisioning advisory lock and ordered membership row locks.
  Authority is checked inside the transaction. Admins manage members only; owners manage elevated roles.
  Company updates use the same identity lock plus the organization row lock.
  They preserve metadata and return the saved snapshot without a post-commit membership reread.
  Company updates require a human session. Optional research dispatch remains a separate post-commit path.
- **Reads and writes go through tRPC**, not `authClient.organization.*`.
- **Name and website are required at onboarding and cannot be skipped**, in the form
  *and* in `updateWorkspaceInput`, posting the same `workspace.update` as settings.
  The primary action saves the workspace and opens the manual CRM.
  A separate action opens optional research configuration after the same save.
- **Onboarded state is `onboardedAt` inside the plugin's `metadata` blob**, not a
  column; `isOnboarded`/`markOnboarded` (`@crm/db/workspace`) are the only accessors,
  and `markOnboarded` preserves every other key.
- **The name starts as `DEFAULT_WORKSPACE_NAME` (`CRM`), a placeholder not an
  answer.** The header renders `<name> CRM`, so `workspaceLabel` tests the name rather
  than comparing to the default.
- **The website queues the agent's `workspace-profile` task** and goes through
  `normalizeDomain`, rejecting null. Stored canonical, so re-saving uncanonically
  counts as a change and re-queues research.

### Gates in `proxy.ts`

Workspace onboarding is the only setup gate. The proxy reads `workspace.get` on every request.
Manual CRM access requires no Context.dev key and no AI agent.

- **`getSessionCookie()` decides signed-in**; pages still resolve the real session via
  `requireMailboxAccess()`.
- **Nothing is cached in a cookie** — a database reset changes the next workspace answer.
- **Research settings never control access** — the proxy does not read `settings.researchKey`.
- **An unreachable API fails open** (`unknown` lets the request through).
- **`/sign-in`, `/grant-access`, `/eve` are ungated.** `/sign-in` is the only path a
  stranger may read; `/` joins it only when `IS_MARKETING` is set.
- **`/onboarding/research` remains available after workspace setup**, with or without a saved key.
  Its Spanish form offers `Continuar sin IA` as navigation without saving a key or changing AI policy.
  The server passes the installation's AI policy to the form.
  Disabled AI prevents research-settings queries and key submissions from this form.
  Enabled AI permits voluntary key configuration; saving a key never proves agent availability.
  The form reports loading, missing, configured, and unreadable key states without blocking manual access.

### The name is also the URL

Served under the workspace slug (`/comp-ai/companies`). **Cosmetic, not tenancy** —
every query still resolves through `WORKSPACE_ID`.

- **The slug is the plugin's column**, written by `workspaceSlug(name)`
  (`@crm/db/workspace`) on rename and create. **Never derive it on read.**
- Provisioning writes the initial slug; `RESERVED_SLUGS` prevents collision with
  a real route (a collision gets `-crm`).
- **The proxy is the only thing that puts the slug on.** Missing or stale slugs are
  redirected with the query string intact, not 404'd; `[slug]/layout.tsx` is the
  backstop.
- `appPath` in `proxy.ts` is the one place `/` resolves for a signed-in rep, which
  keeps every `callbackURL` correct without knowing about slugs.
- **Renaming moves the URL**, so `workspace-form.tsx` replaces the location onto the
  slug `workspace.update` returns.

## SSO is a row, not a deployment

An `ssoProvider` row via Better Auth's `sso` plugin, on Settings → SSO, because a
self-hoster's admin cannot redeploy.

- **OpenID Connect only** — issuer, client id, secret; endpoints from discovery. No
  SAML UI: it needs an X.509 cert and SP signing key we have nowhere to keep.
- `SsoService` passes `WORKSPACE_ID`, never an input.
- **Management is tRPC (`sso.*`); signing in is `authClient.signIn.sso()`.**
- **`sso.signInOptions` is the one public procedure in the app.** Every other `sso.*`
  takes `AuthMiddleware` at the *method*, which is what leaves it open. A client
  secret is never read back out.
- **It is the API's answer, not the app's** — the API serves `/api/auth/*`.
- Local sign-in remains available without Google, Microsoft or SSO.
- An unreadable provider configuration never creates a phantom Google button.
- **A provider hides the social buttons, it does not disable them** —
  `/sign-in?method=google` and `?method=microsoft` still work, so a mistyped issuer
  cannot lock an admin out.
- **Signing in with an IdP does not cost you Gmail.** `needsMailboxGrant` (`@crm/auth`)
  walls only an account whose sign-in rows are *all* mailbox providers — Google,
  Microsoft, or both — and none of them granted. `mailboxGrantsNeeded` returns which,
  so `/grant-access` offers the button they can actually use.
- `databaseHooks.user.create.before` rejects public account creation, including SSO sign-ups.
- `ALLOWED_SIGN_IN` and existing membership also gate session creation.
- `organizationProvisioning: { disabled: true }` prevents automatic SSO membership provisioning.

## tRPC is the data surface; REST is auth and health only

- **One router per module**, `*.router.ts` (the codegen glob), with
  `@Router({ alias })` and `@UseMiddlewares(AuthMiddleware)`. **No `AuthMiddleware`
  means public — there is no other guard.**
- **Routers are thin**: zod in, service call out; Prisma lives in `*.service.ts`.
- Services throw Nest's `HttpException` family; `DomainErrorMiddleware` maps them.
- **Filter, sort and paginate in Prisma.** List procedures take `listInput` and return
  `{ rows, total, facetCounts }`. Never filter a whole table in the browser; never
  interpolate `sort` into a field name — use `resolveOrderBy`.
- **`src/generated/server.ts` is generated *and committed*, and `build` must never
  regenerate it** — the generator needs GLIBC 2.39, newer than Vercel's build image.
  Only `check-types` and `dev` run it. If the app cannot see a new procedure, it has
  not run.

## The OpenAPI document is built at runtime, not committed

`GET /openapi.json` serves one document: Nest's own controllers plus a REST bridge
under `/rest` generated from every tRPC procedure. Swagger UI renders it at `/`.
`createApp` builds both halves and merges them, so nothing is generated at build
time and no file is checked in — the document is whatever the routers are.

`SwaggerModule.setup` runs **before** `app.init()`, because it registers its Express
routes synchronously and Nest's own routing would otherwise shadow them. The factory
form defers building the document to the first request, which is what lets it read
the tRPC router that only exists after init.

Two rules follow for the serverless build:

- `@nestjs/swagger` stays in `EXTERNALS` in `apps/api/scripts/build-func.mjs`, because
  `swagger-ui-dist` resolves its assets from disk at runtime and cannot be bundled.
- Anything external must be **vendored**, and vendoring follows non-optional
  `peerDependencies`, not only `dependencies`. Nest packages declare their runtime
  needs as peers, so following `dependencies` alone ships a function that throws
  `MODULE_NOT_FOUND` on the first request. Adding a name to `EXTERNALS` without
  checking it lands in `.vercel/output` breaks production, and the build stays green.

## Two mail providers, one pipeline

`apps/api/src/mailbox` is everything neither Google nor Microsoft owns:
`MailboxApiClient` (bearer GET, and the one place a status code becomes an outcome),
`SyncStateService` (the `MailboxSync` row), `MailboxTokenService`,
`MailboxMatchService`, `participants.ts`, `message-text.ts`, and
`ThreadWriterService`.

- **`ThreadWriterService.store` is the only writer of `EmailThread`, `EmailMessage`
  and the `EMAIL` activity.** Gmail and Outlook each parse their own wire format down
  to one `IncomingMessage` and hand it over; matching, threading, counting and
  stamping happen once. A second copy of that is how a rule like *reply before you
  create a company* comes to be true in one inbox and not the other.
- **A thread is keyed by RFC message id, not by the provider's thread id.** Root comes
  from `References` → `In-Reply-To` → own `Message-ID`, so a rep on Gmail and a rep on
  Outlook land on the same `EmailThread` for the same conversation. Graph only returns
  `internetMessageHeaders` when `$select`ed and not for every message, so Outlook falls
  back to `outlook-conversation:<conversationId>` — threading that still holds inside
  Outlook, just not across to Gmail.
- **`MailboxSync.source` is the discriminator** — `calendar`, `gmail`, `outlook`. Each
  provider's module only ever sees its own, and `sync/mailbox-sync.service.ts` is the
  one place that dispatches. One cron, one budget:
  `POST /internal/sync/mailboxes` (`/google` is kept as an alias so an existing
  deployment's cron keeps working).
- **Gmail is forward-only from a `historyId`, Outlook from a timestamp.** Graph has no
  mailbox-wide delta, so the Outlook cursor is the last `receivedDateTime` seen,
  re-read with a one-second overlap; `rfcMessageId` is unique, so the overlap costs a
  duplicate fetch and never a duplicate row.
- **Microsoft has no token-revocation endpoint.** `revoke` clears the columns and the
  UI says the consent itself is removed in the user's Microsoft account. Google's still
  posts to `oauth2.googleapis.com/revoke` and refuses to clear if that fails.

## Not every address on a thread is a person

`externalParticipants` (`mailbox/participants.ts`) is the one gate, discarding **us**
(allow-list domains, `User` table), **rep decisions** (`SuppressedContact`,
`SuppressedDomain`), and **addresses no human reads**.

- **`isMachineDomain` (`companies/domain.ts`) sits beside `FREE_EMAIL_DOMAINS`**;
  `domainFromEmail` returns null for both, and `companyForEmail` is the only path from
  address to company — so a caller ignorant of the rule still cannot create one.
  `.calendar.google.com` covers shared calendars, rooms and ICS feeds.
- **Matches the host, never a substring** — `calendar.acme.com` is a real company.
- **`isMachineAddress` also catches opaque local parts** (24 hex chars, UUIDs),
  deliberately narrow: a false positive is a real customer never filed.
- **It leaves no row** — a rep may still type these into quick-add; only the *inbox*
  is barred from deciding. `syncAttendees` filters the same addresses beside
  `attendee.resource`.
- **`isAutomatedAddress` is a separate list about the local part** (`sales@`,
  `noreply@`), which is why `support@acme.com` never becomes a lead.

## People on a deal

`DealContact` is the join, and `deals.attachContact` / `detachContact` /
`setContactRole` are the only ways to write it. `deals.contactOptions` is what the
picker reads.

- **A contact on a deal works at that deal's company**, enforced in the service and
  not merely by the picker — the same rule as `companies.setPrimaryContact`.
- **Attaching is an upsert and re-attaching keeps the role already there**, so a
  double click cannot blank what somebody typed.
- **Detaching removes the row, never the contact.** They stay in the CRM, on the
  company, with their history.
- **`role` is blanked to null, never stored as `""`** — `blankToNull`, as everywhere
  else.

## Deleting a record is archive first, purge later

`contacts.archive`, `companies.archive`, `deals.archive` set `archivedAt`. Nothing
else changes — no suppression, no cascade cleanup, no stamp recompute — because the
row is still there, just filtered out of every list.

- **`archivedFilter(input.archived)` is in every `buildWhere` and every `facetCounts`
  where.** A list call defaults to `archived: false`; the Archived view is the same
  procedure with `archived: true`. There is no third "everything" mode — mixing
  active and archived rows in one table is exactly what this feature removes.
- **`archive`/`restore` are a bare `update({ archivedAt })`, nothing more.** They do
  not touch `AgentTask`, `SuppressedContact`, or `lastActivityAt` — the record is
  unchanged, only hidden.
- **`purge` is the old `delete`.** Same transaction, same suppression, same
  `AgentTask`/`AgentEvent` cleanup, same `ActivityStampService.recomputeAfterDelete`.
  Read the rest of this section as `purge`'s contract, not `archive`'s.
- Opportunity purge requires an owner and prior archive. Other entity purge paths
  still need complete corporate authorization. Do not infer a rep's deletion authority from this legacy interface.

**Pruning**: `ArchiveRetentionController` (`internal/archive/prune`, `CRON_SECRET`-gated,
`apps/api/vercel.json`) reads `AppSetting.archiveRetentionDays`
(`readArchiveRetentionDays`, `@crm/db/settings`, default 180) and calls each service's
`purgeExpired(before)` — `findMany({ archivedAt: { lte: before } })` capped at
`ARCHIVE.prune.maxBatch` (`archive/archive-config.ts`), then `purge` per row through
the ordinary `runBulk`. Settings → General has the day count
(`settings.archiveRetention` / `setArchiveRetention`).

Below is `purge`'s contract — everything that used to be `delete`'s:

- **A purged contact is suppressed by address**, or the sync recreates them from the
  next thread. `ContactsService.purge` writes `SuppressedContact`, and
  `externalParticipants` drops it like a `SuppressedDomain` — one filter covering
  contact creation, company auto-creation and attribution.
- **Keyed lower case.** `normalizeEmail` (`crm/values.ts`) is the one canonicaliser,
  on `contacts.create`, `.update` and the suppression; conflict checks and `allowAgain`
  match case-insensitively.
- **The address comes from the delete itself**
  (`tx.contact.delete({ select: { email: true } })`), not a read before it — and the
  404 is that statement's own `P2025` through `translate`.
- **Adding them back lifts the suppression** via `allowAgain` **inside the write's
  transaction**. Never automatic.
- **Purging a company does not suppress its domain** — its people survive with no
  company, and domain suppression stays the explicit Settings → Connections control.
- **Clear `AgentTask` and `AgentEvent` yourself** — they carry `contactId`/`companyId`
  with no foreign key, so nothing cascades.
- **Recompute `lastActivityAt` on exactly the records the purge reached.**
  `ActivityStampService.targetsOf(where)` collects them *inside* the transaction (the
  evidence is what gets deleted); `recomputeMany` restamps. A company's `where` must
  follow its deals: `{ OR: [{ companyId }, { deal: { companyId } }] }`.
  `recomputeAll()` is for a purge only.
- **Recompute after commit, logging rather than throwing** — the row is already gone,
  and a raised error makes the browser skip invalidation and retry into a 404.

## Money

A deal is sold in one currency and reported in another, and **only `baseAmount` may
ever be summed**. The rules — `baseCurrency`, `countedWhere`/`pendingWhere`, frozen
rates, the supported currencies, the keyless feed, and why the fetcher is the one
documented exception to *no intelligence in the API* — are in **`docs/currency.md`**.
Read it before touching any amount, total, chart or rate.

## Freshness: invalidate the query, don't disable the cache

- **Invalidate in `onSuccess` through `useCrmCache()`** (`lib/trpc/cache.ts`), never by
  listing keys at the call site. Say what changed — `cache.deal(id)`,
  `cache.company(id)`, `cache.contact(id)`, `cache.activity()`. **A new mutation adds a
  call there, not a new list of keys.**
- **A deletion is `cache.removed(ref)`** — one wide fan-out, and the only place
  `refetchType: "none"` is right: the deleted record's `byId` query is still mounted
  while the sheet animates shut, so refetching reads a 404 into the closing sheet,
  while leaving it alone serves 30s of a dead record from cache.
- **`{ settle: "record" }`** for inline editors, so the field's spinner clears without
  waiting for the table.
- **Infinite queries need `pathKey()`, not `queryKey()`** — the latter stamps
  `{ type: "query" }` and silently cannot match `{ type: "infinite" }`.
  `activities.timeline` is read both ways.
- **`cache-manager` is per-value and opt-in**, not an interceptor;
  `AuthService.getProfile` is the model.
- **Background writes need polling, not invalidation** — `refetchInterval` while
  `PENDING`/`RUNNING`, via `isEnriching()` and `ENRICHMENT_POLL_MS`. **Lists poll too,
  not just the sheet.**

## Configurable processes and assigned tasks — 2026-10-02

`pipelines.list` returns stable process and stage identifiers.
`pipelines.configure` requires owner or admin membership and an expected revision for an existing process.
It preserves existing stage outcomes and identifiers. New stages require explicit result classifications.
The outcomes are OPEN, WON, LOST, and DISQUALIFIED. Custom names do not create new result enums.
Stages retire instead of disappearing. Occupied stages and occupied processes cannot retire.
The default process stays active. A replacement default requires an explicit configuration change.

Opportunity creation records the acting server user and selected stage snapshot.
Members assign opportunities to themselves. Owners and admins select another current member.
`deals.setStage` accepts a stable stage identifier. A cross-process move requires the explicit process identifier.
Lost and disqualified results require a reason. The service locks the record and validates current membership inside the transaction.
`deals.stageHistory` returns actor, date, reason, and immutable process and stage name snapshots.
History does not fabricate transitions for migrated legacy records.
Entering WON creates a handoff task for the opportunity owner. Repeating the same stage does not duplicate that transition.
Reopening and winning again creates a new handoff task. No contractual SLA is assigned by this rule.

`deals.bulkSetStage` applies the same per-record stage rules and returns partial success information.
It does not promise a transaction across all selected records.
`pipelineStageIds` filters actual stage identifiers. The legacy `stage` filter remains a result classification filter.
Stage sorting uses process name, stage position, expected close date, and record ID.

`activities.create`, `updateTask`, and `complete` use the acting server identity, never a submitted author.
Author and assignee are separate. Reassignment never rewrites authorship.
Task priorities span zero through three. Deadlines require an explicit zoned instant.
Members edit their authored or assigned tasks. Owners and admins also edit other tasks and reassign them.
Current membership and all linked record relationships are checked inside the transaction.
Archived links reject task creation and mutation. Personal queues use the assignee.
Serializable conflicts return an explicit conflict. Unexpected database errors remain errors.
Derived activity-stamp failures are logged after commit. They do not report a committed mutation as failed.

`cache.pipelines()`, `cache.deal(id)`, and `cache.activity()` invalidate related views and stage history.
The [business receipt](verification/2026-10-02-business-flow.md) records the earlier tested paths.

## Opportunity authorization increment — 2026-10-03

All eighteen `deals` router methods forward `ctx.user.id` to the service.
Public contracts do not accept an acting identity or retention cutoff.
Opportunity reads require current workspace membership. Members read the shared installation, not only their assigned opportunities.
Supported roles remain owner, admin, and member. Unknown roles fail closed. The five-role product policy remains incomplete.

Update, archive, restore, and contact-link mutations lock current membership and the opportunity inside a transaction.
Members modify their own opportunities. Owners and admins modify other opportunities.
Reassignment requires owner or admin authority and a current supported workspace member as the target.
Archived opportunities reject edits and contact-link changes. Restore precedes further mutation.
Repeating archive preserves the first archive timestamp and does not extend the retention deadline.
Contact attachment and role changes require an active same-company contact. Detachment repairs a stale link.
Company transfers require an active destination and cannot invalidate attached contact relationships.

Money preparation runs outside the write transaction. The locked write compares the prepared amount and currency snapshot.
A changed amount or currency produces a conflict instead of overwriting the newer money.
Current membership is checked again after preparation. This prevents writes after a role change at that boundary.
These tests do not prove simultaneous PostgreSQL concurrency or transactional report snapshots.

Public purge requires owner authority and an archived opportunity. Admin purge grants remain unimplemented and denied.
Trusted retention uses a private cutoff-guarded deletion helper. It does not obtain authority from a submitted user or body field.
The existing retention controller still requires separate operational review before enabling scheduled deletion.
Bulk operations check each record and report partial success. They do not promise a single transaction across the selection.

The [authorization receipt](verification/2026-10-03-opportunity-authorization.md) records isolated tests and remaining work.
Companies, contacts, fields, keys, exports, workers, and other routers still require complete corporate authorization review.

## Managed identity increment — 2026-10-03

`AuthMiddleware` consults current workspace membership through the injected database for every protected procedure.
Missing, unknown and suspended roles are rejected. App server session gates also require active membership.
Workspace reads no longer create membership. The legacy enrolment helper is not a fallback from workspace.get.
Supported roles remain owner, admin and member. Manager, rep and viewer are not accepted until their entire policy is implemented.

`workspace.createMember`, `setMemberRole`, `setMemberStatus`, `resetMemberPassword`, and `identityAudit` require a human session, not an API key.
Creation validates address eligibility and creates user, credential, membership and identity audit in one locked transaction.
An admin creates/manages only members. Only owners manage elevated users and assign elevated roles.
The last active owner cannot be demoted or suspended. Suspended owners do not satisfy this invariant.
Role changes and status changes revoke all existing sessions and disable keys atomically with their audit event.
Reactivation never enables old keys or cookies. Repeat status changes preserve date and do not create duplicate events.
Recovery changes an existing local credential, requires a reason, revokes access, and never returns the password or hash.
Self-recovery through the administrative endpoint is rejected. Mail delivery, first-owner recovery and forced password change remain pending.

`identityAuditEvent` preserves actor and role/status snapshots without generated credentials. Ordinary row edits and deletions are rejected by a database trigger.
The database operator remains outside this protection boundary. Business audit completeness is not implied.
`workspace.members.activeOnly` filters suspended memberships for assignment pickers while user management can inspect all memberships.

Direct HTTP organization and API-key plugin endpoints are disabled using their actual registered paths.
Guarded tRPC services retain the server SDK; frontend calls must not use authClient.organization or authClient.apiKey management.
Key management requires owner/admin and finite expiration. Creation rechecks current authority before returning its secret; changed authority disables the new key.
Key scopes, dedicated credentials for workers and remaining plugin paths need separate implementation/review.
The [identity receipt](verification/2026-10-03-managed-identity.md) includes actual loopback Nest/tRPC HTTP checks, not just direct service calls.

## Company and contact authorization increment — 2026-10-04

All sixteen company procedures and fifteen contact procedures pass `ctx.user.id` as a required service argument.
Public contracts never derive authority from submitted owner, actor or retention fields.
`crm/record-access.ts` checks current supported membership and suspension. Service reads also require that membership.
Shared reads remain installation-wide. Owner filters do not create confidential record scopes.
Write transactions lock membership and the record before ownership checks or custom-field changes.
Members modify assigned records only. Owners and admins also modify other records and reassign responsibility.
Assignment targets require active supported membership. Creation defaults to the authenticated actor.
Members cannot claim unassigned records. Elevated actors can explicitly clear assignment.

Archived records reject edits. Repeated archive preserves its first timestamp.
Bulk operations apply per-record checks and return partial results. They do not promise a selection-wide transaction.
Public purge requires an owner and prior archive. Private retention rechecks the locked archive cutoff.
Company purge locks child opportunities and rejects active children. Trusted retention skips that company instead.
Existing suppression, agent cleanup, cascading relations and post-commit activity restamping remain preserved.

Contact creation distinguishes omitted company selection from explicit null selection.
`CompanyDirectoryService.companyForContact` performs optional domain matching and creation inside the contact transaction.
It assigns automatically created companies to the checked contact owner and emits the creation event transactionally.
The older trusted mailbox directory path remains separate and needs worker capability review.
New and restored contacts require active linked companies.
Primary designation requires an active same-company contact. Clear designation before moving or archiving that contact.
Opportunity-contact links reject contact transfers until authorized detachment.
Suggestion settlement locks the contact and rechecks proposal status before applying fields.

Explicit research queues use the same transaction for authorization and task creation.
Company/contact enrichment status updates share that transaction. Dispatch starts only after commit.
Queue rollback tests use real SQL rows, blocked provider calls and a substituted dispatch notification.
These tests do not accept automatic post-commit research, AI workers, concurrency, or external-provider behavior.
Automatic company creation/domain-change research and workspace research retain separate outbox work.
The [receipt](verification/2026-10-04-company-contact-authorization.md) records the selected SQL and real loopback HTTP checks.
Fields, connections, exports, keys, background writers and UI permissions still need full corporate-policy implementation.
