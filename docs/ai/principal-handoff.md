# Installation AI policy: principal handoff

Date: 2026-10-01.
Scope: one private CRM installation per company, on local infrastructure or a VPS.

## Shared contract

Import `isAiEnabled`, `aiFeaturePolicy`, and `requireAiEnabled` from `@crm/env/features`.
The module has no configuration-file loader, database import, or provider client.
Only the exact string `CRM_AI_ENABLED=true` enables AI.
Missing, empty, `false`, `1`, uppercase, and whitespace values disable AI.
Provider keys, stored research keys, and Vercel OIDC never grant AI permission.
The policy reads the current process environment on each call.
Use the same flag in the API, app proxy, and agent process.

Disabled policy result:

```json
{
  "enabled": false,
  "status": "disabled",
  "code": "CRM_AI_DISABLED",
  "flag": "CRM_AI_ENABLED",
  "reason": "AI is disabled for this installation. Set CRM_AI_ENABLED=true to enable AI explicitly."
}
```

Agent AI HTTP endpoints return HTTP 503, `ok:false`, and this result.
They also return `error` with the same reason and `cache-control:no-store`.
`GET /internal/crm/ai-status` returns HTTP 200 with the policy after bridge authentication.
Invalid bridge authentication returns HTTP 401 before the internal policy result.
The enabled flag grants permission. It does not prove provider availability.

## Required API gates

The principal owns these files. This AI change does not edit them.

| File | Paths that require the policy | Disabled behavior |
| --- | --- | --- |
| `apps/api/src/agent/agent-trigger.service.ts` | `enqueue`, `createEventTask`, `fieldBackfillRecords`, `backfill`, `pokeRoute`, `canReachAgent`, `drainQueues` | Do not create AI tasks or send dispatch requests. Preserve the caller's manual transaction. |
| Same file | `withCrmEvents`, `withTasks` | Run `work(tx, ...)`. Supply inert AI enqueue callbacks. Never suppress the CRM transaction. |
| `apps/api/src/agent/dispatch-heartbeat.service.ts` | Periodic queue drain | Do not claim availability or dispatch work. |
| `apps/api/src/agent/agent-runs.service.ts` | `runNow`, `retryRun` | Reject with a disabled result before creating or changing run rows. Preserve cancellation and history reads. |
| `apps/api/src/conversations/conversations.service.ts` | `createBuilder`, `submitBuilder`, `answerBuilderQuestion` | Reject before submission, attachment, or conversation writes. Preserve stored transcript reads and manual deletion. |
| `apps/api/src/companies/companies.service.ts` | `enrich`, `research`, `bulkEnrich` | Reject before PENDING/RUNNING updates or queue writes. |
| `apps/api/src/contacts/contacts.service.ts` | `enrich`, `bulkEnrich` | Reject before PENDING/RUNNING updates or queue writes. |
| `apps/api/src/fields/fields.service.ts` | `backfill`, automatic calls to `fieldBackfillRecords` | Reject explicit AI backfill. Save manually configured fields without AI queues. |
| `apps/api/src/backfill/backfill.service.ts` | `auto`, workspace/company/contact sweeps | Disable AI sweeps before cache timestamps or background work. Do not block sign-in. |
| `apps/api/src/settings/settings.service.ts` | `setResearchKey` | Do not verify with providers or launch backfill while disabled. A saved key never enables AI. |
| `apps/api/src/agent/research-key.service.ts` | `verify` | Return disabled/unverified locally. Do not transmit candidate keys while disabled. |
| `apps/api/src/settings/settings.router.ts` and `settings.contracts.ts` | Research-key response contract | Expose the feature status separately from whether a key exists. |
| Company, contact, field, agent, and conversation routers | Procedures that call the explicit operations above | Map disabled policy before successful queued/working output. Update shared output schemas as needed. |

Automatic trigger callers also require review:

| File | Automatic path |
| --- | --- |
| `apps/api/src/companies/companies.service.ts` | Company create/update calls `companyCreated`. |
| `apps/api/src/companies/company-directory.service.ts` | Directory creation calls `companyCreated`. |
| `apps/api/src/contacts/contacts.service.ts` | Contact creation calls `contactCreated`. |
| `apps/api/src/workspace/workspace.service.ts` | Website update calls `workspaceChanged`. |
| `apps/api/src/mailbox/mailbox-match.service.ts` | Synced contact creation calls `contactCreated`. |
| `apps/api/src/google/calendar-sync.service.ts` | Meeting detection calls `meetingSoon`. |
| `apps/api/src/tracking/tracking-filing.service.ts` | Filed contact creation calls `contactCreated`. |
| `apps/api/src/fields/fields.service.ts` | Field create/update/research calls `fieldBackfillRecords`. |
| `apps/api/src/backfill/backfill.service.ts` | Sign-in hook, workspace profile, brand, portrait, and contact sweeps. |

Central queue guards cover these callers only when callers do not mark records as researching first.
Read each caller before relying on central coverage.
Existing queued rows remain pending. The agent does not lease, finish, or relabel them while disabled.
Installation-wide status must override pending rows in the interface.
Never present those rows as Thinking, Researching, or retryable provider failures while AI is disabled.

## Required app and configuration changes

| File | Required change |
| --- | --- |
| `apps/app/app/eve/v1/[...path]/route.ts` | Block model messages before proxy fetch. Return the disabled contract. Preserve history and cancellation where available. |
| `apps/app/lib/onboarding.ts` | Make `readResearchGate` settled while AI is disabled. |
| `apps/app/proxy.ts` | Bypass the research-key gate while AI is disabled. Keep authentication and ordinary workspace onboarding. |
| Research onboarding and agent panels | Display Disabled and preserve the manual CRM navigation. Disable AI send/research controls. |
| `.env.example` | Document `CRM_AI_ENABLED=false` and explicit installation opt-in. |
| Root `turbo.json` | Add `CRM_AI_ENABLED` to `globalPassThroughEnv`. Do not put credentials in cache-key `env`. |
| `apps/api/src/config/env.validation.ts` | Declare the optional flag and retain default-false semantics. |

The user reserves these changes for the principal.
No per-package `.env` belongs in this increment.
No deployment, external platform update, or real credential test belongs in this increment.
