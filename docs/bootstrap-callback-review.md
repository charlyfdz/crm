# Bootstrap callback correction and review

Local candidate, 2026-09-17. No deployment or production approval.

## Membership admission evidence — later increment

The current test contains 26 cases and 139 assertions. Three cases extend the
23-case historical baseline below. This increment changes tests only, not auth policy.

The actual API `AuthMiddleware` accepts a valid failed-enrollment session with no
active workspace and calls the synthetic downstream handler. It rejects an
anonymous request before that handler. A healthy subsequent login repairs the
membership in the fake transaction store without duplicating the user or account.

These are bounded characterization tests. They do not call a CRM data service,
mount the Nest HTTP router, exercise browser UI, or prove cross-instance access.
The session comes from the real auth callback and an uncached session lookup.
The downstream handler is a test fixture, not a real data read or write.

`docs/api.md` explicitly preserves login availability when enrollment fails.
Changing that policy requires an admission decision. A question is pending for
the three entity instances: block new access on failed enrollment, or preserve
the original availability behavior. Existing-session revocation remains separate.
No production behavior changes, new dependencies, or deployment follow from these tests.

The earlier three patches and source capsule retain their bytes. This test
increment is separate and is not included in the existing capsule or API bundle.

## Required correction

Do not use the first bootstrap patch on its own. Its new `before` hook returned
the result of an inner `createAuthMiddleware` call. Better Auth 1.6.25 returns a
middleware envelope in this context. The outer hook treated it as the endpoint
response and returned HTTP 200 with `{"headers":{}}`, without an authorization URL.
The earlier initiation tests assembled their own auth configuration. They did not
import `src/auth.ts`, so they missed this integration error introduced by our patch.

The correction awaits `slackConnectGuard(ctx)` without returning that envelope.
This guard returns no context update; it either completes or throws. Its denials
remain effective. The regression test imports the actual CRM auth configuration,
including the signup, membership, sign-in notification and Slack hooks.

## Evidence

The original callback artifact ran 23 cases; the later increment above adds three:

- 21 protocol and configuration cases: authorization URL, signed RS256 ID token,
  PKCE S256 exchange, first owner, second member, returning identity, session,
  health endpoint, signup allow-list, state/cookie/provider/code rejection,
  replay, issuer/audience/expiry/signature rejection, logout and Slack denials.
- Two characterization cases expose existing lifecycle limitations. Their passing
  assertions are NOT security acceptance: an existing identity can sign in after
  the signup allow-list is emptied; failed membership enrollment still creates a
  session with a null active workspace.

Actual Better Auth/SSO 1.6.25, auth handler and membership hooks run. The Prisma
adapter is replaced by the installed memory adapter; membership tables and
transactions are fakes. Discovery/token/JWKS use an in-process fetch fixture;
unexpected URLs throw. The generated signing key remains in memory. All test
identities, credentials and tokens are synthetic. No server, DB, IdP account,
browser, mailbox or network connection is created.

The provider fixture does not advertise a userinfo endpoint. In installed SSO
1.6.25, that endpoint uses a different branch. The ID-token assertions do not
certify that branch or any real provider configuration. The first-owner test is
sequential and starts with empty tables. It is not a concurrency, lock or migration
test. Existing users and first-login ordering can affect owner assignment.

Logout is checked with `disableCookieCache=true`. It proves server-session
deletion in the fixture, not immediate invalidation of a previously cached cookie.
The application has a five-minute cookie cache. Real revocation and expiry
semantics must be tested with the approved runtime and browser.

## Reproduction without installation

Use an isolated checkout with existing dependencies and no `.env` or `.env.local`.
Run the isolated files in separate Bun processes. Do not import them into the full
integration suite: module mocks are process-wide. Do not run root dev, build, DB,
migration, seed or broad test commands.

From the repository root:

```sh
bun --no-env-file test ./packages/auth/test/bootstrap-callback.isolated.ts
bun --no-env-file test ./packages/auth/test/bootstrap-oidc.spec.ts ./packages/auth/test/mailbox-grant.spec.ts
bun --no-env-file test ./packages/db/test/context-mode.spec.ts
bun --no-env-file test ./apps/app/test/onboarding-gate.spec.ts
bun --no-env-file test ./apps/agent/test/context-mode.isolated.ts ./apps/agent/test/verify-key.spec.ts
```

For the API test, change the working directory to `apps/api`, then run:

```sh
bun --no-env-file test ./test/context-mode.isolated.ts
```

The API working directory selects its legacy decorator configuration. Running
this test from the root fails at class-validator before cases run. Do not alter
the production decorators to work around the wrong test working directory.

From the root, use the installed TypeScript binary with `--noEmit --incremental
false -p` on each of `review/auth-callback.tsconfig.json`,
`review/context-api.tsconfig.json` and `review/context-app.tsconfig.json`.
The review configs pin auth/DB resolution when reusing installed dependencies;
they are not production build settings. The app check also needs the existing
local Next generated route types. Bun used: 1.4.2; upstream declares 1.3.12.

## Admission gates

Keep the three entities Planned with separate app/API/DB/secrets/hostnames/backups.
Before real use, approve the IdP/client and exact first owner per entity, verify
empty-instance bootstrap and owner ordering on Postgres, and decide how account
revocation and failed enrollment must behave. Changing ALLOWED_SIGN_IN is not a
revocation procedure. A valid session alone is not proof of workspace authority;
verify API/UI denials without membership. No such runtime authorization is claimed.

Real IdP/userinfo, PostgreSQL/concurrency, UI, full build, lifecycle/revocation,
negative cross-instance tests, capacity, restore, egress and VPN remain pending.
No new services, dependencies or real data are authorized by this report.
