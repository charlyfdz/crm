# Operator-controlled Context mode

Status: local review candidate, not deployed. Base: CRM 1.15.3 at
`6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`, with the separate OIDC bootstrap candidate.

## Contract

`CRM_CONTEXT_MODE` accepts exactly `enabled` or `disabled`. An absent value means
`enabled`, which preserves the original requirement for a Context key. Invalid or
blank values are rejected; errors do not echo their values. The variable is declared
in `.env.example`, API environment validation, and Turbo global pass-through.

With `disabled`:

- The shared key reader returns null without reading the stored key. Direct key
  writes are rejected. Existing keys are retained, not deleted or replaced.
- Settings reports `{ mode: "disabled", configured: false, hint: null }`.
  The authenticated mutation rejects with `FORBIDDEN` before verification, writes,
  or the company backfill. The agent rejects candidate-key probes too.
- The onboarding proxy settles only an explicit disabled response. Legacy responses
  without a mode preserve the key gate. Invalid or denied responses remain unknown;
  the existing unknown-state proxy behavior is unchanged, not authorization.
- The research page retains its session/mailbox guard, then checks the authenticated
  API before redirecting. Settings shows a disabled notice, not a key or signup form.
- Context client resolution and company/people capabilities use the shared reader.
  A cached client is discarded on the next resolution while disabled.
- The telemetry capability flag is false. This does not turn telemetry off.

The sign-in allow-list, session validation, workspace onboarding and membership
checks are not bypassed. No dummy key or pre-created account is needed.

## Scope and rollout gates

This mode disables the Context vendor only. It does not disable other research,
models, agents, schedulers, mail, tracking, image sources, telemetry, or all egress.
For the first manual-only pilot, do not start the agent or its scheduler, do not
configure social providers or the agent bridge, disable telemetry separately,
and verify the network policy. No real data or deployment is authorized by this patch.

Set the same mode on the API and every agent process. Restart them together before
accepting requests. An older agent or inconsistent configuration is not a safe rollout.
This is not a live kill switch: already-started requests or tasks are not cancelled.
To re-enable, first approve provider use, cost, and data scope. A retained key becomes
available again; a keyless installation returns to the onboarding requirement.

Each entity requires its own stack, identity, data, secrets and backup. The mode does
not provide tenancy or prove runtime separation. Full IdP callback, owner enrollment,
Postgres, browser flows, build/deploy, restore and cross-instance denial remain pending.

## Reproducible checks with existing dependencies

Use an isolated checkout without `.env` or `.env.local`. Do not run the root test,
development, migration or seed scripts. Run only these files with the existing Bun:

```sh
bun test ./packages/db/test/context-mode.spec.ts
bun test ./apps/app/test/onboarding-gate.spec.ts
(cd apps/api && bun test ./test/context-mode.isolated.ts)
bun test ./apps/agent/test/context-mode.isolated.ts ./apps/agent/test/verify-key.spec.ts
```

The two `.isolated.ts` files must run in separate Bun processes. They deliberately
mock injected services or the DB module and are not auto-discovered as suite tests.
No DB server, live vendor or listening HTTP server is used. Test results are not
proof of authorization or network isolation in production.

The review type-check configurations in `review/` pin workspace auth/DB imports to
this checkout when it reuses preinstalled dependencies. They do not modify production
resolution. Generate local Next route types with `NEXT_TELEMETRY_DISABLED=1` and
`next typegen`, then run `tsc --noEmit --incremental false -p` on each review config.
No package installation or full build is part of this procedure.
