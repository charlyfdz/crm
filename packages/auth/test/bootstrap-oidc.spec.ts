import { afterEach, describe, expect, it } from "bun:test";
import { sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthMiddleware } from "better-auth/api";
import {
	assertBootstrapIdentityScopes,
	assertBootstrapOrigins,
	BOOTSTRAP_PROVIDER_ID,
	bootstrapSignInProviders,
	bootstrapTrustedOrigins,
	readBootstrapOidc,
} from "../src/bootstrap-oidc";

const fixture = {
	issuer: "https://idp.example.test/realms/synthetic",
	domain: "example.test",
	clientId: "synthetic-crm-client",
	clientSecret: "synthetic-secret-not-a-credential",
};
const raw = (overrides = {}) => JSON.stringify({ ...fixture, ...overrides });
const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("bootstrap configuration", () => {
	it("leaves absent configuration disabled", () => {
		expect(readBootstrapOidc(undefined)).toBeUndefined();
		expect(readBootstrapOidc(" ")).toBeUndefined();
		expect(bootstrapSignInProviders(undefined)).toEqual([]);
	});
	it("uses the fixed provider and identity-only PKCE configuration", () => {
		const config = readBootstrapOidc(raw());
		if (!config) throw new Error("Missing synthetic bootstrap configuration");
		expect(config.providerId).toBe(BOOTSTRAP_PROVIDER_ID);
		expect(config.oidcConfig?.pkce).toBe(true);
		expect(config.oidcConfig?.scopes).toEqual(["openid", "email", "profile"]);
		expect(config.oidcConfig?.discoveryEndpoint).toBe(
			`${fixture.issuer}/.well-known/openid-configuration`,
		);
	});
	it("returns only public sign-in fields", () => {
		expect(bootstrapSignInProviders(readBootstrapOidc(raw()))).toEqual([
			{ providerId: "bootstrap-oidc", name: "Bootstrap OIDC" },
		]);
	});
	for (const [name, value] of Object.entries({
		http: { issuer: "http://idp.example.test" },
		credentials: { issuer: "https://user:password@idp.example.test" },
		query: { issuer: "https://idp.example.test/?key=secret" },
		fragment: { issuer: "https://idp.example.test/#fragment" },
		wildcard: { domain: "*.example.test" },
		urlDomain: { domain: "https://example.test" },
		blankId: { clientId: " " },
		blankSecret: { clientSecret: " " },
		providerOverride: { providerId: "google" },
		scopeOverride: { scopes: ["Mail.Read"] },
	})) {
		it(`rejects ${name} with a redacted error`, () => {
			try {
				readBootstrapOidc(raw(value));
				throw new Error("Expected rejection");
			} catch (error) {
				expect((error as Error).message).toBe(
					"Invalid CRM_BOOTSTRAP_OIDC. See docs/bootstrap-oidc.md. Configuration values are redacted.",
				);
			}
		});
	}
	it("rejects malformed JSON without reflecting input", () => {
		expect(() => readBootstrapOidc("private-value{")).toThrow(
			"Configuration values are redacted.",
		);
	});
});

function isolatedAuth(configured = true) {
	const state = {
		user: [],
		session: [],
		account: [],
		verification: [],
		ssoProvider: [],
	};
	const bootstrap = readBootstrapOidc(raw());
	if (!bootstrap) throw new Error("Missing synthetic bootstrap configuration");
	const requests: string[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = input instanceof Request ? input.url : String(input);
		requests.push(url);
		if (url !== bootstrap.oidcConfig?.discoveryEndpoint) {
			throw new Error("Unexpected network request blocked by the test harness");
		}
		return Response.json({
			issuer: fixture.issuer,
			authorization_endpoint: `${fixture.issuer}/authorize`,
			token_endpoint: `${fixture.issuer}/token`,
			jwks_uri: `${fixture.issuer}/jwks`,
			response_types_supported: ["code"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["RS256"],
		});
	}) as typeof fetch;
	const auth = betterAuth({
		baseURL: "https://crm.example.test",
		secret: "synthetic-auth-secret-for-offline-tests-only",
		database: memoryAdapter(state),
		trustedOrigins: bootstrapTrustedOrigins(
			configured ? bootstrap : undefined,
			["https://crm.example.test"],
		),
		telemetry: { enabled: false },
		logger: { disabled: true },
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (configured) {
					assertBootstrapOrigins(
						ctx.path,
						ctx.body,
						ctx.headers?.get("origin") ?? null,
						["https://crm.example.test"],
					);
					assertBootstrapIdentityScopes(ctx.path, ctx.body);
				}
			}),
		},
		plugins: [
			sso({
				defaultSSO: configured ? [bootstrap] : [],
				organizationProvisioning: { disabled: true },
			}),
		],
	});
	const start = (extra = {}, origin = "https://crm.example.test") =>
		auth.handler(
			new Request("https://crm.example.test/api/auth/sign-in/sso", {
				method: "POST",
				headers: { "Content-Type": "application/json", Origin: origin },
				body: JSON.stringify({
					providerId: BOOTSTRAP_PROVIDER_ID,
					callbackURL: "/",
					...extra,
				}),
			}),
		);
	return { start, state, requests };
}

describe("installed Better Auth bootstrap flow", () => {
	it("starts OIDC with no existing user, session or provider row", async () => {
		const { start, state, requests } = isolatedAuth();
		const response = await start();
		if (response.status !== 200)
			throw new Error(`Synthetic start failed: ${await response.text()}`);
		expect(response.status).toBe(200);
		const result = await response.json();
		const url = new URL(result.url);
		expect(url.origin).toBe("https://idp.example.test");
		expect(url.searchParams.get("scope")).toBe("openid email profile");
		expect(url.searchParams.get("redirect_uri")).toBe(
			"https://crm.example.test/api/auth/sso/callback/bootstrap-oidc",
		);
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
		expect(url.searchParams.get("code_challenge")).toBeTruthy();
		expect(url.searchParams.get("state")).toBeTruthy();
		expect(result.url).not.toContain(fixture.clientSecret);
		expect(state.user).toHaveLength(0);
		expect(state.session).toHaveLength(0);
		expect(state.ssoProvider).toHaveLength(0);
		expect(requests.length).toBeGreaterThan(0);
	});
	it("retains the original failure without bootstrap", async () => {
		const { start, requests } = isolatedAuth(false);
		expect((await start()).status).toBe(404);
		expect(requests).toHaveLength(0);
	});
	for (const scopes of [
		["Mail.Read"],
		["openid", "offline_access"],
		["https://www.googleapis.com/auth/gmail.readonly"],
	]) {
		it(`rejects additional scope ${scopes.at(-1)} before discovery`, async () => {
			const { start, requests, state } = isolatedAuth();
			expect((await start({ scopes })).status).toBe(400);
			expect(requests).toHaveLength(0);
			expect(state.session).toHaveLength(0);
		});
	}
	it("rejects scope escalation through domain selection too", async () => {
		const { start, requests } = isolatedAuth();
		expect(
			(
				await start({
					providerId: undefined,
					domain: fixture.domain,
					scopes: ["Mail.Read"],
				})
			).status,
		).toBe(400);
		expect(requests).toHaveLength(0);
	});
	it("does not accept an unconfigured provider ID", async () => {
		const { start, requests } = isolatedAuth();
		expect((await start({ providerId: "other-entity" })).status).toBe(404);
		expect(requests).toHaveLength(0);
	});
	it("rejects a foreign callback origin", async () => {
		const { start, state } = isolatedAuth();
		const response = await start({
			callbackURL: "https://other.example.test/",
		});
		if (response.status !== 403)
			throw new Error(`Synthetic callback rejection: ${await response.text()}`);
		expect(response.status).toBe(403);
		expect(state.session).toHaveLength(0);
	});
	for (const field of [
		"callbackURL",
		"errorCallbackURL",
		"newUserCallbackURL",
	]) {
		it(`does not authorize the IdP as an application ${field}`, async () => {
			const { start, requests } = isolatedAuth();
			expect(
				(await start({ [field]: "https://idp.example.test/receive" })).status,
			).toBe(403);
			expect(requests).toHaveLength(0);
		});
	}
	it("does not authorize browser requests from the IdP origin", async () => {
		const { start, requests } = isolatedAuth();
		expect((await start({}, "https://idp.example.test")).status).toBe(403);
		expect(requests).toHaveLength(0);
	});
});
