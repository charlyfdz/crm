# Identity-only bootstrap

## Required follow-up correction

The first local bootstrap artifact has an integration error in the composed auth
hook. Apply the callback correction as well; do not use that artifact alone.
See [callback review](bootstrap-callback-review.md) for the cause, actual-config
regression tests, reproduction and unresolved lifecycle gates. Earlier initiation
tests did not import the real CRM auth configuration.

Status: review candidate. No deployment approval follows from this patch.

An empty installation has no authenticated administrator.
The existing SSO registration endpoint requires that administrator.
Google and Microsoft sign-in also request mailbox access.

`CRM_BOOTSTRAP_OIDC` configures Better Auth's existing `defaultSSO` OIDC path.
The API includes its public name in `sso.signInOptions`.
The configuration creates no user, session, provider row, password, or organization.
Normal OIDC callbacks, database hooks, and `ALLOWED_SIGN_IN` still apply.
The first accepted user receives the existing workspace owner role.

## Operator configuration

Use a dedicated OIDC client for each installation.
Use an approved identity provider with controlled email claims and no public enrollment.
Set `ALLOWED_SIGN_IN` to the one approved owner email for first enrollment.
Verify ownership before adding other approved addresses.
Do not use a shared domain allow-list during first enrollment.

Keep Google, Microsoft, and Slack credentials unset for the identity-only pilot.
Store this JSON through the deployment secret store or the single root environment file:

```json
{
  "issuer": "https://idp.example.test/realms/synthetic",
  "domain": "example.test",
  "clientId": "synthetic-crm-client",
  "clientSecret": "REPLACE_IN_SECRET_STORE"
}
```

The example is not deployable configuration.
The issuer uses HTTPS without credentials, query parameters, or fragments.
Better Auth requires the issuer origin in its discovery trust list.
The adapter adds that exact origin, without wildcards.
Separate request and callback checks retain the original application-origin boundary.
The identity provider cannot become an application callback or browser request origin through this addition.
Discovery endpoints on another origin remain rejected. Review those providers separately.
The provider ID is always `bootstrap-oidc`.
The callback is `<API_URL>/api/auth/sso/callback/bootstrap-oidc`.
PKCE is enabled. The requested scopes are `openid email profile`.
No mailbox or offline-access scope belongs to this profile.
While bootstrap is configured, `/sign-in/sso` rejects caller-supplied scopes outside this identity set.
This restriction also applies to database SSO providers until the operator removes bootstrap configuration.
Pin the same allowed scopes in the identity provider's client registration.

The API never returns the issuer, domain, client ID, or client secret through sign-in options.
Malformed configuration stops startup with a redacted error.
An absent value preserves the original authentication configuration.

## Lifecycle and limits

The provider lives in deployment configuration, not the SSO settings table.
SSO settings cannot edit or delete it. Rotate its secret through deployment configuration.
Better Auth reserves its provider ID while this configuration exists.
Never reuse that ID for a database provider.
Do not enable this profile over an existing database provider with that ID.
Keep the same client and provider ID for existing accounts.
Changing either identity source requires an account migration and rollback review.
Removing the variable removes this sign-in method. Retain another verified method before removal.

Each entity still needs separate application, database, secrets, hostname, and backups.
This patch does not establish those boundaries.
This patch does not grant access to an existing identity provider.
It does not disable the Context onboarding gate, the agent, telemetry, or external network access.
The first synthetic pilot still requires those separate gates.
Do not start the root development command or migrations against an existing database.

## Verification

Run only the named bootstrap test with existing dependencies and no environment files.
Its isolated Better Auth instance uses an in-memory adapter and synthetic HTTPS responses.
It does not use the CRM database, production credentials, or a running identity provider.
Postgres, Nest API, browser login, owner assignment, and cross-instance isolation need separate verification.

Source contract: Better Auth SSO 1.6.25, installed in the source checkout.
See https://github.com/better-auth/better-auth/blob/v1.6.25/packages/sso/src/types.ts.
Current general documentation: https://better-auth.com/docs/plugins/sso.
