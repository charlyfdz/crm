import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { memoryAdapter } from "better-auth/adapters/memory";
import { AuthMiddleware } from "../../../apps/api/src/trpc/middlewares/auth.middleware";

const FIXTURE = {
	app: "https://crm.example.test",
	issuer: "https://idp.example.test/realms/synthetic",
	clientId: "synthetic-callback-client",
	clientSecret: "synthetic-client-secret-not-a-credential",
	owner: "owner@example.test",
	member: "member@example.test",
	provider: "bootstrap-oidc",
	kid: "synthetic-callback-signing-key",
};

type UserRow = {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	createdAt: Date;
};
type SessionRow = {
	id: string;
	userId: string;
	activeOrganizationId?: string | null;
};
type AccountRow = {
	id: string;
	userId: string;
	accountId: string;
	providerId: string;
	scope?: string;
};
type MemberRow = {
	id: string;
	userId: string;
	organizationId: string;
	role: string;
	createdAt: Date;
};
type OrganizationRow = {
	id: string;
	name: string;
	slug: string;
	createdAt: Date;
};
type VerificationRow = {
	id: string;
	identifier: string;
	value: string;
	expiresAt: Date;
};

const rows = {
	user: [] as UserRow[],
	session: [] as SessionRow[],
	account: [] as AccountRow[],
	member: [] as MemberRow[],
	organization: [] as OrganizationRow[],
	verification: [] as VerificationRow[],
	ssoProvider: [],
	rateLimit: [],
};
let membershipFailure = false;
const memberWhere = (where: {
	organizationId_userId: { organizationId: string; userId: string };
}) =>
	rows.member.find(
		(row) =>
			row.organizationId === where.organizationId_userId.organizationId &&
			row.userId === where.organizationId_userId.userId,
	);
const fakeTables = {
	organization: {
		upsert: async ({ create }: { create: OrganizationRow }) => {
			const existing = rows.organization.find((row) => row.id === create.id);
			if (existing) return existing;
			rows.organization.push(create);
			return create;
		},
		update: async ({
			where,
			data,
		}: {
			where: { id: string };
			data: { slug: string };
		}) => {
			const row = rows.organization.find((item) => item.id === where.id);
			if (!row) throw new Error("Missing synthetic organization");
			row.slug = data.slug;
			return row;
		},
	},
	member: {
		count: async ({
			where,
		}: {
			where: { organizationId: string; role?: { in: string[] } };
		}) =>
			rows.member.filter(
				(row) =>
					row.organizationId === where.organizationId &&
					(!where.role || where.role.in.includes(row.role)),
			).length,
		createMany: async ({ data }: { data: MemberRow[] }) => {
			for (const row of data)
				if (
					!rows.member.some(
						(item) =>
							item.userId === row.userId &&
							item.organizationId === row.organizationId,
					)
				)
					rows.member.push(row);
			return { count: data.length };
		},
		upsert: async ({
			where,
			create,
		}: {
			where: {
				organizationId_userId: { organizationId: string; userId: string };
			};
			create: MemberRow;
		}) => {
			const existing = memberWhere(where);
			if (existing) return existing;
			rows.member.push(create);
			return create;
		},
		findUnique: async ({
			where,
		}: {
			where: {
				organizationId_userId: { organizationId: string; userId: string };
			};
		}) => memberWhere(where) ?? null,
	},
	user: {
		findMany: async () =>
			[...rows.user].sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
					a.id.localeCompare(b.id),
			),
		findUnique: async ({ where }: { where: { id: string } }) =>
			rows.user.find((row) => row.id === where.id) ?? null,
	},
};
const fakeDb = {
	...fakeTables,
	$transaction: async <T>(
		work: (tx: typeof fakeTables) => Promise<T>,
	): Promise<T> => {
		if (membershipFailure) throw new Error("Synthetic membership unavailable");
		return work(fakeTables);
	},
};

mock.module("@crm/db", () => ({ db: fakeDb }));
mock.module("@crm/db/slack-inventory", () => ({
	queueSlackInventorySync: async () => {
		throw new Error("Slack is outside this fixture");
	},
}));
mock.module("better-auth/adapters/prisma", () => ({
	prismaAdapter: () => memoryAdapter(rows),
}));

process.env.NODE_ENV = "test";
process.env.BETTER_AUTH_SECRET =
	"synthetic-auth-secret-for-callback-tests-only";
process.env.API_URL = FIXTURE.app;
process.env.APP_URL = FIXTURE.app;
process.env.CRM_BOOTSTRAP_OIDC = JSON.stringify({
	issuer: FIXTURE.issuer,
	domain: "example.test",
	clientId: FIXTURE.clientId,
	clientSecret: FIXTURE.clientSecret,
});
process.env.ALLOWED_SIGN_IN = FIXTURE.owner;
process.env.CRM_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";
for (const key of [
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"MICROSOFT_CLIENT_ID",
	"MICROSOFT_CLIENT_SECRET",
	"AUTH_COOKIE_DOMAIN",
])
	delete process.env[key];
process.env.SLACK_CLIENT_ID = "synthetic-slack-client";
process.env.SLACK_CLIENT_SECRET = "synthetic-slack-secret";

const { auth } = await import("../src/auth");
const { onSignedIn } = await import("../src/signed-in");
const signedIn: string[] = [];
onSignedIn((user) => {
	signedIn.push(user.id);
});

const signingKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
	...signingKey.publicKey.export({ format: "jwk" }),
	kid: FIXTURE.kid,
	alg: "RS256",
	use: "sig",
};
type Profile = {
	sub: string;
	email: string;
	name: string;
	email_verified: boolean;
};
let profile: Profile;
let jwtOverrides: { iss?: string; aud?: string; exp?: number };
let signatureInvalid = false;
let expectedChallenge = "";
let tokenCalls = 0;
let jwksCalls = 0;
const originalFetch = globalThis.fetch;

function jwt() {
	const now = Math.floor(Date.now() / 1000);
	const encode = (value: object) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	const message = `${encode({ alg: "RS256", kid: FIXTURE.kid })}.${encode({ ...profile, iss: FIXTURE.issuer, aud: FIXTURE.clientId, iat: now, exp: now + 300, ...jwtOverrides })}`;
	const signature = sign(
		"RSA-SHA256",
		Buffer.from(message),
		signingKey.privateKey,
	);
	if (signatureInvalid) signature[0] = (signature[0] ?? 0) ^ 1;
	return `${message}.${signature.toString("base64url")}`;
}

function installSyntheticProvider() {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		if (request.url === `${FIXTURE.issuer}/.well-known/openid-configuration`)
			return Response.json({
				issuer: FIXTURE.issuer,
				authorization_endpoint: `${FIXTURE.issuer}/authorize`,
				token_endpoint: `${FIXTURE.issuer}/token`,
				jwks_uri: `${FIXTURE.issuer}/jwks`,
				response_types_supported: ["code"],
				subject_types_supported: ["public"],
				id_token_signing_alg_values_supported: ["RS256"],
				token_endpoint_auth_methods_supported: ["client_secret_basic"],
			});
		if (request.url === `${FIXTURE.issuer}/jwks`) {
			jwksCalls += 1;
			return Response.json({ keys: [publicJwk] });
		}
		if (request.url === `${FIXTURE.issuer}/token`) {
			tokenCalls += 1;
			const body = new URLSearchParams(await request.text());
			const challenge = createHash("sha256")
				.update(body.get("code_verifier") ?? "")
				.digest("base64url");
			const basic = `Basic ${Buffer.from(`${FIXTURE.clientId}:${FIXTURE.clientSecret}`).toString("base64")}`;
			if (
				body.get("code") !== "synthetic-code" ||
				challenge !== expectedChallenge ||
				request.headers.get("authorization") !== basic ||
				body.get("redirect_uri") !==
					`${FIXTURE.app}/api/auth/sso/callback/${FIXTURE.provider}`
			)
				return Response.json({ error: "invalid_grant" }, { status: 400 });
			return Response.json({
				access_token: "synthetic-access-token",
				token_type: "Bearer",
				expires_in: 300,
				scope: "openid email profile",
				id_token: jwt(),
			});
		}
		throw new Error("Unexpected outbound request blocked by callback fixture");
	}) as typeof fetch;
}

beforeEach(() => {
	for (const list of Object.values(rows)) list.length = 0;
	signedIn.length = 0;
	membershipFailure = false;
	profile = {
		sub: "synthetic-owner",
		email: FIXTURE.owner,
		name: "Synthetic Owner",
		email_verified: true,
	};
	jwtOverrides = {};
	signatureInvalid = false;
	tokenCalls = 0;
	jwksCalls = 0;
	process.env.ALLOWED_SIGN_IN = FIXTURE.owner;
	installSyntheticProvider();
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});
afterAll(() => {
	globalThis.fetch = originalFetch;
});

function cookies(response: Response) {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
}

async function start() {
	const response = await auth.handler(
		new Request(`${FIXTURE.app}/api/auth/sign-in/sso`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: FIXTURE.app },
			body: JSON.stringify({
				providerId: FIXTURE.provider,
				callbackURL: `${FIXTURE.app}/`,
				errorCallbackURL: `${FIXTURE.app}/sign-in`,
				newUserCallbackURL: `${FIXTURE.app}/onboarding`,
			}),
		}),
	);
	expect(response.status).toBe(200);
	const body = await response.json();
	if (!body.url)
		throw new Error(
			`Synthetic sign-in did not return an authorization URL: ${JSON.stringify(body)}`,
		);
	const authorization = new URL(body.url);
	expectedChallenge = authorization.searchParams.get("code_challenge") ?? "";
	return {
		state: authorization.searchParams.get("state") ?? "",
		cookie: cookies(response),
		authorization,
	};
}

async function callback(
	flow: Awaited<ReturnType<typeof start>>,
	overrides: {
		state?: string;
		cookie?: string;
		code?: string;
		error?: string;
		provider?: string;
	} = {},
) {
	const url = new URL(
		`${FIXTURE.app}/api/auth/sso/callback/${overrides.provider ?? FIXTURE.provider}`,
	);
	url.searchParams.set("state", overrides.state ?? flow.state);
	url.searchParams.set("code", overrides.code ?? "synthetic-code");
	if (overrides.error) url.searchParams.set("error", overrides.error);
	return auth.handler(
		new Request(url, { headers: { cookie: overrides.cookie ?? flow.cookie } }),
	);
}

async function session(cookie: string) {
	const response = await auth.handler(
		new Request(`${FIXTURE.app}/api/auth/get-session?disableCookieCache=true`, {
			headers: { cookie },
		}),
	);
	return response.json();
}

async function inspectApiAuthorization(cookie: string) {
	const active = await auth.api.getSession({
		headers: new Headers({ cookie }),
		query: { disableCookieCache: true },
	});
	const next = mock(
		async (
			..._args: Parameters<Parameters<AuthMiddleware["use"]>[0]["next"]>
		) => ({ ok: true as const, data: "synthetic-downstream-reached" }),
	);
	const execute = () =>
		new AuthMiddleware().use({
			ctx: { session: active },
			type: "query",
			path: "synthetic.membership-observation",
			input: undefined,
			getRawInput: async () => undefined,
			meta: undefined,
			signal: undefined,
			next,
		});
	return { active, next, execute };
}

describe("actual CRM auth configuration with a synthetic signed OIDC callback", () => {
	it("creates the first user and owner through the real hooks and creates a session", async () => {
		const flow = await start();
		expect(rows.user).toHaveLength(0);
		expect(rows.session).toHaveLength(0);
		const response = await callback(flow);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(`${FIXTURE.app}/onboarding`);
		expect(tokenCalls).toBe(1);
		expect(jwksCalls).toBeGreaterThan(0);
		expect(rows.user).toHaveLength(1);
		expect(rows.member).toHaveLength(1);
		expect(rows.member[0]?.role).toBe("owner");
		expect(rows.session[0]?.activeOrganizationId).toBe("workspace");
		expect(signedIn).toEqual(rows.user.map((user) => user.id));
		const active = await session(cookies(response));
		expect(active?.user.email).toBe(FIXTURE.owner);
		expect(active?.session.activeOrganizationId).toBe("workspace");
		expect(rows.account[0]?.providerId).toBe(FIXTURE.provider);
		expect(rows.account[0]?.scope?.split(/[ ,]+/).sort()).toEqual([
			"email",
			"openid",
			"profile",
		]);
		expect(
			response.headers.getSetCookie().some((value) => /HttpOnly/i.test(value)),
		).toBe(true);
		expect(
			response.headers
				.getSetCookie()
				.every((value) => !/;\s*Domain=/i.test(value)),
		).toBe(true);
	});
	it("serves the actual health endpoint without an internal middleware envelope", async () => {
		const response = await auth.handler(
			new Request(`${FIXTURE.app}/api/auth/ok`),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});
	it("returns no session for an anonymous reader", async () => {
		expect(await session("")).toBeNull();
	});
	it("enrolls a second approved identity as member, not a second owner", async () => {
		await callback(await start());
		process.env.ALLOWED_SIGN_IN = `${FIXTURE.owner},${FIXTURE.member}`;
		profile = { ...profile, sub: "synthetic-member", email: FIXTURE.member };
		const response = await callback(await start());
		expect(response.headers.get("location")).toBe(`${FIXTURE.app}/onboarding`);
		expect(rows.user).toHaveLength(2);
		expect(rows.member.map((row) => row.role)).toEqual(["owner", "member"]);
		expect((await session(cookies(response)))?.user.email).toBe(FIXTURE.member);
	});
	it("reuses the existing subject without duplicating users or membership", async () => {
		await callback(await start());
		const userId = rows.user[0]?.id;
		const response = await callback(await start());
		expect(response.headers.get("location")).toBe(`${FIXTURE.app}/`);
		expect(rows.user).toHaveLength(1);
		expect(rows.account).toHaveLength(1);
		expect(rows.member).toHaveLength(1);
		expect(rows.member[0]?.role).toBe("owner");
		expect((await session(cookies(response)))?.user.id).toBe(userId);
	});
	for (const allowed of ["", "someone-else@example.test"]) {
		it(`rejects a new identity when the allow-list is ${allowed ? "another account" : "empty"}`, async () => {
			process.env.ALLOWED_SIGN_IN = allowed;
			const response = await callback(await start());
			expect(response.headers.get("location") ?? "").not.toBe(
				`${FIXTURE.app}/onboarding`,
			);
			expect(rows.user).toHaveLength(0);
			expect(rows.session).toHaveLength(0);
			expect(rows.member).toHaveLength(0);
		});
	}
	for (const [label, overrides] of Object.entries({
		"wrong state": { state: "synthetic-wrong-state" },
		"missing cookie": { cookie: "" },
		"tampered cookie": { cookie: "crm.state=invalid" },
		"foreign provider": { provider: "other-entity" },
		"provider cancellation": { error: "access_denied" },
	})) {
		it(`refuses ${label} before the token exchange`, async () => {
			const response = await callback(await start(), overrides);
			expect(response.status).toBe(302);
			expect(response.headers.get("location")).toContain("error=");
			expect(tokenCalls).toBe(0);
			expect(rows.session).toHaveLength(0);
			expect(rows.user).toHaveLength(0);
		});
	}
	it("refuses replay of a consumed state without another token exchange", async () => {
		const flow = await start();
		await callback(flow);
		const response = await callback(flow);
		expect(response.headers.get("location")).toContain("error=");
		expect(tokenCalls).toBe(1);
		expect(rows.session).toHaveLength(1);
	});
	it("refuses a rejected authorization code", async () => {
		const response = await callback(await start(), { code: "rejected-code" });
		expect(response.headers.get("location")).toContain("error=");
		expect(rows.session).toHaveLength(0);
		expect(rows.user).toHaveLength(0);
	});
	for (const [label, claims] of Object.entries({
		issuer: { iss: "https://other.example.test" },
		audience: { aud: "other-entity-client" },
		expiry: { exp: Math.floor(Date.now() / 1000) - 300 },
	})) {
		it(`rejects an ID token with an invalid ${label}`, async () => {
			jwtOverrides = claims;
			const response = await callback(await start());
			expect(response.headers.get("location")).toContain("token_not_verified");
			expect(rows.session).toHaveLength(0);
			expect(rows.user).toHaveLength(0);
		});
	}
	it("rejects a bad ID token signature", async () => {
		signatureInvalid = true;
		const response = await callback(await start());
		expect(response.headers.get("location")).toContain("token_not_verified");
		expect(rows.session).toHaveLength(0);
	});
	it("invalidates the server session on logout", async () => {
		const response = await callback(await start());
		const cookie = cookies(response);
		const logout = await auth.handler(
			new Request(`${FIXTURE.app}/api/auth/sign-out`, {
				method: "POST",
				headers: { origin: FIXTURE.app, cookie },
			}),
		);
		expect(logout.status).toBe(200);
		expect(rows.session).toHaveLength(0);
		expect(await session(cookie)).toBeNull();
	});
	it("still rejects unauthenticated Slack linking through the composed guard", async () => {
		const response = await auth.handler(
			new Request(`${FIXTURE.app}/api/auth/oauth2/link`, {
				method: "POST",
				headers: { origin: FIXTURE.app, "content-type": "application/json" },
				body: JSON.stringify({ providerId: "slack", callbackURL: FIXTURE.app }),
			}),
		);
		expect(response.status).toBe(401);
		expect(rows.session).toHaveLength(0);
	});
	it("still rejects Slack linking by an ordinary member", async () => {
		await callback(await start());
		process.env.ALLOWED_SIGN_IN = `${FIXTURE.owner},${FIXTURE.member}`;
		profile = { ...profile, sub: "synthetic-member", email: FIXTURE.member };
		const login = await callback(await start());
		const response = await auth.handler(
			new Request(`${FIXTURE.app}/api/auth/oauth2/link`, {
				method: "POST",
				headers: {
					origin: FIXTURE.app,
					cookie: cookies(login),
					"content-type": "application/json",
				},
				body: JSON.stringify({ providerId: "slack", callbackURL: FIXTURE.app }),
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("existing lifecycle behavior requiring an admission decision", () => {
	it("rejects an anonymous request before the API downstream handler", async () => {
		const probe = await inspectApiAuthorization("");
		await expect(probe.execute()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(probe.next).not.toHaveBeenCalled();
	});
	it("passes a failed-enrollment session through the actual API auth middleware", async () => {
		membershipFailure = true;
		const response = await callback(await start());
		const probe = await inspectApiAuthorization(cookies(response));
		expect(rows.member).toHaveLength(0);
		expect(probe.active?.session).toMatchObject({ activeOrganizationId: null });
		expect(probe.active?.user.email).toBe(FIXTURE.owner);
		expect(await probe.execute()).toEqual({
			ok: true,
			data: "synthetic-downstream-reached",
		});
		expect(probe.next).toHaveBeenCalledTimes(1);
		expect(probe.next.mock.calls[0]?.[0]?.ctx?.user).toEqual(
			probe.active?.user,
		);
	});
	it("repairs membership on a healthy subsequent login without duplicating the user", async () => {
		membershipFailure = true;
		await callback(await start());
		const userId = rows.user[0]?.id;
		expect(rows.member).toHaveLength(0);
		membershipFailure = false;
		const response = await callback(await start());
		const probe = await inspectApiAuthorization(cookies(response));
		expect(rows.user).toHaveLength(1);
		expect(rows.account).toHaveLength(1);
		expect(rows.member).toHaveLength(1);
		expect(rows.member[0]?.userId).toBe(userId);
		expect(rows.member[0]?.role).toBe("owner");
		expect(probe.active?.session).toMatchObject({
			activeOrganizationId: "workspace",
		});
		expect(await probe.execute()).toMatchObject({ ok: true });
	});
	it("does not revoke an existing identity when the signup allow-list is emptied", async () => {
		await callback(await start());
		process.env.ALLOWED_SIGN_IN = "";
		const response = await callback(await start());
		expect(response.headers.get("location")).toBe(`${FIXTURE.app}/`);
		expect(rows.user).toHaveLength(1);
		expect(rows.session).toHaveLength(2);
		expect((await session(cookies(response)))?.user.email).toBe(FIXTURE.owner);
	});
	it("still creates a session without an active workspace when enrollment fails", async () => {
		membershipFailure = true;
		const response = await callback(await start());
		expect(response.status).toBe(302);
		expect(rows.user).toHaveLength(1);
		expect(rows.member).toHaveLength(0);
		expect(rows.session).toHaveLength(1);
		expect(rows.session[0]?.activeOrganizationId).toBeNull();
		expect(
			(await session(cookies(response)))?.session.activeOrganizationId,
		).toBeNull();
	});
});
