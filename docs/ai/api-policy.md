# API AI opt-in policy

Date: 2026-10-02.
Pilot: Corporativo S&F.
Scope: private, independent CRM installation. No homelab deployment occurs in this increment.

## Installation contract

Only the exact value `CRM_AI_ENABLED=true` enables AI.
The shared contract comes from `@crm/env/features`.
The API reads the current policy at each entry point.
Missing flags, keys, bridge secrets, and stored keys never grant permission.
The principal owns environment validation and root environment documentation.
The API contains no new vendor client or model inference.

`requireApiAiEnabled()` lives in `apps/api/src/agent/ai-policy.ts`.
It throws `AiPolicyDisabledException` before explicit AI submissions or writes.
The exception contains `code=CRM_AI_DISABLED` and HTTP status 403.
The existing domain middleware returns tRPC `FORBIDDEN` with a `CRM_AI_DISABLED:` message prefix.
The exception response also contains the structured installation policy.
The middleware preserves the message but does not forward that response body.
This is a policy rejection, not a provider outage or retry instruction.

The NestJS/tRPC skill guides service gates and response schemas.
The repository's domain middleware translates Nest exceptions into tRPC failures.
Routers remain thin. Existing authentication middleware remains unchanged.

## Files changed

- `apps/api/src/agent/ai-policy.ts`
- `apps/api/src/agent/agent-trigger.service.ts`
- `apps/api/src/agent/agent-queue.service.ts`
- `apps/api/src/agent/dispatch-heartbeat.service.ts`
- `apps/api/src/agent/research-key.service.ts`
- `apps/api/src/agent/agent-runs.service.ts`
- `apps/api/src/agent/agent-definitions.service.ts`
- `apps/api/src/conversations/conversations.service.ts`
- `apps/api/src/conversations/conversations.contracts.ts`
- `apps/api/src/settings/settings.service.ts`
- `apps/api/src/settings/settings.contracts.ts`
- `apps/api/src/settings/model-catalog.service.ts`
- `apps/api/src/workspace/workspace.service.ts`
- `apps/api/test/ai-policy-api.spec.ts`
- `docs/ai/api-policy.md`

No generated router file changes. Existing generated types import the updated response schemas.
No environment, root configuration, authentication, or provider credential changes.

## Implemented boundaries

| Boundary | Disabled behavior |
| --- | --- |
| `AgentTriggerService.enqueue` | Automatic calls return false without database work. Required calls reject with the policy exception. |
| `companyRequested` | Rejects before task creation. |
| `withCrmEvents` | Runs the caller's transaction with an inert event callback. Preserves transaction errors. |
| `withTasks` | Runs the caller's transaction with inert task callbacks. |
| `fieldBackfillRecords`, `backfill` | Returns zero counts without task reads, creation, or merging. |
| `createEventTask` | Writes no task. |
| `canReachAgent` | Returns false despite bridge configuration. |
| Queue drains, pokes, posts, cancellation redelivery | Sends no request and starts no new work. |
| `DispatchHeartbeatService` | Starts no timer or initial drain. |
| `AgentRunsService.runNow`, `retryRun` | Rejects before access queries, replay lookup, and run creation. |
| `AgentDefinitionsService.deploy`, `resume` | Rejects before activating versions or triggers. |
| `ConversationsService.createBuilder`, `submitBuilder`, `answerBuilderQuestion` | Rejects before conversation, submission, or attachment writes. |
| `AgentQueueService` | Reports no active queued records. Stored task rows remain unchanged. |
| Builder lists and details | Returns `ai` policy. Pending submissions do not produce `working` list state. |
| `ResearchKeyService.verify` | Returns `outcome=disabled`, `code=CRM_AI_DISABLED`, and reason locally. Sends no candidate key. |
| `SettingsService.setResearchKey` | Rejects before verification or saving. Rechecks policy after verification and before launching backfill. |
| `SettingsService.researchKey` | Returns configured status, masked hint, and separate `ai` policy. Never returns the complete key. |
| `SettingsService.setAgentModel` | Rejects model selection and reset while disabled. |
| `ModelCatalogService.models`, `fetchCatalog` | Returns null before cache or remote reads. |
| `WorkspaceService.update` | Saves workspace changes without automatic profile research. |

History reads, transcript deletion, archive retention, and local run cancellation remain available.
Manual transactions still run. AI queue callbacks do not swallow manual failures.
Disabling AI does not delete or relabel existing queued tasks.
Local cancellation still marks the run and its actions as cancelled.
Disabled AI prevents cancellation delivery requests to the agent.
This flag does not terminate an already-running model request.
The operator stops the agent process to terminate in-flight execution.
Keep the API, app, and agent policy consistent.

## First specialist integration handoff — historical

Use `requireApiAiEnabled()` for explicit operations.
Use `isAiEnabled()` for automatic work that must preserve the manual operation.
Do not change ordinary manual CRUD into a policy rejection.

| Location | Required integration |
| --- | --- |
| `apps/api/src/companies/companies.service.ts` | Gate `enrich`, `research`, and `bulkEnrich` before queries or batch success output. |
| Same file, domain update | Preserve manual domain edits. Do not set new `PENDING` research state while disabled. |
| Same file, `create` and `update` | Automatic favicon resolution remains outside central queue coverage. Gate remote enrichment for local-only operation. |
| `apps/api/src/companies/company-directory.service.ts` | Explicit creation still sets `PENDING`. Present disabled policy separately without inventing active research. |
| `apps/api/src/contacts/contacts.service.ts` | Gate `enrich` and `bulkEnrich` before queries or batch handling. Preserve manual creation. |
| `apps/api/src/fields/fields.service.ts` | Gate explicit `backfill` before reads. Automatic calls receive zero counts from the central gate. |
| `apps/api/src/backfill/backfill.service.ts` | Gate `auto` before cache timestamps or background work. Gate explicit `run`. Protect workspace and image sweeps. |
| `apps/api/src/slack/slack-channels.service.ts` | `create` calls the agent directly. Add an explicit policy gate before its bridge request. |
| `apps/api/src/slack/slack-connection.service.ts` | Preserve connection reads. Explicit inventory and join requests need policy-aware feedback before local writes. |
| `apps/api/src/enrichment/enrichment.service.ts` | Counts and record states need installation-policy handling. Stored pending rows do not prove active work. |
| `packages/db/src/slack-inventory.ts` | `queueSlackInventorySync` creates tasks directly. Add an automatic opt-in guard before transaction and throttle checks. |
| `packages/auth/src/auth.ts` | Slack hooks call that inventory writer. Guard the writer or these automatic hook calls. |
| `packages/auth/src/signed-in.ts` | This file invokes registered handlers. It contains no queue write. Guard the backfill handler, not all sign-in handlers. |
| `packages/db/src/agent-tasks.ts` | This file contains task constants and predicates. It contains no queue writer. No write guard belongs here. |
| App AI proxy and interface | Guard model messages and render the installation policy. Never show Thinking or Researching while disabled. |
| Existing AI integration suites | Explicitly opt into AI in their isolated test environment. Default-off behavior changes their assumptions. |

Automatic company, contact, calendar, tracking, mailbox, and CRM-event queue calls now reach guarded central methods.
Central queue guards do not cover direct writers or direct network requests listed above.
The principal owns those integrations. This increment does not claim installation-wide completion.

## Principal integration — 2026-10-02

The principal completes the direct company, contact, field, backfill, favicon, image, Slack, and inventory gates listed above.
Manual creation and edits remain available. Disabled creation uses `SKIPPED`, not invented active research.
List and detail contracts carry the installation policy. Stored task and record history remains unchanged.
The enrichment queue returns idle before database reads while AI is disabled.
It rechecks policy after task reads and subject reads.

Private and shared builder chats receive the policy. Disabled policy suppresses operational polling and live stream attachment.
The interface removes the message composer, retry action, live run card, research actions, and pending enrichment banner.
The header does not mount the enrichment queue. Record Agent tabs display a shared accessible notice.
Stored history remains readable. Historical transcript events and submission statuses remain stored history, not execution proof.

The principal verifies 109 API tests across policy, direct flows, and configuration contracts.
The new UI suite verifies ten presentation and notice cases. Browser acceptance remains separate.
Current API and app typechecks and builds return exit 0.
See the [integrated receipt](../verification/2026-10-02-local-foundations.md) for exact scope and commands.

No installed-system acceptance, provider call, PostgreSQL recovery, or network-wide offline claim follows from those tests.

## First specialist verification — historical

Run commands from `apps/api` to load its decorator configuration:

```powershell
bun test test/ai-policy-api.spec.ts
bun run check-types
```

The test suite uses dependency mocks and a rejecting network spy.
Its opt-in cases return mock responses. They do not call providers.
Tests use synthetic values and perform no database queries.
The first two regression tests fail against the previous queue implementation.
The implementation passes those tests after adding the gates.

Coverage includes exact flag parsing, automatic queue suppression, explicit rejection, and preserved manual transactions.
Coverage also includes key masking, disabled verification, model-catalog suppression, transcript reads, and local cancellation.
The suite checks policy changes during key verification.
It does not prove real PostgreSQL behavior, browser behavior, provider availability, or production acceptance.

Verified results on 2026-10-02:

- Focused suite: 38 tests pass, zero failures, 170 assertions.
- API TypeScript: `bun run check-types` returns exit 0.
- Biome: checks all 14 changed TypeScript files without errors.
- Scoped `git diff --check`: returns exit 0.
- No provider call, deployment, database mutation, or external platform write occurs during verification.

## Issues

1. NOT DONE — Installation-wide real runtime and complete interface acceptance remain pending after principal integration.
   Fix: execute synthetic integrated API and browser scenarios. Keep the first specialist handoff as historical evidence.
2. NOT DONE — Real database, HTTP, and browser acceptance tests remain pending.
   Fix: use an isolated synthetic database and the manual pilot acceptance plan.
3. RISK — The policy flag does not cancel a request already running in the agent.
   Fix: stop the agent process during policy shutdown. Add runtime cancellation in a separate increment.
4. UNKNOWN — GitNexus has no index for this checkout. Graph impact verification does not run.
   Fix: use the verified source review here. Index the checkout through a separately authorized workflow.
