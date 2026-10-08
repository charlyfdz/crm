import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import type { Auth } from "../src/auth";
import type { provisionUser as provision } from "../src/provision-user";

const integration =
	process.env.CRM_LOCAL_ACCESS_TEST === "1" ? describe : describe.skip;
const owner = {
	name: "Propietario sintético",
	email: "owner@example.test",
	password: "Synthet1c-Access-Test-Password",
	role: "owner",
	bootstrap: true,
	workspaceName: "Piloto sintético",
};

integration("managed local access on a disposable PGlite database", () => {
	let db: Db;
	let auth: Auth;
	let provisionUser: typeof provision;
	let ownerId: string;
	let cookie: string;

	async function post(path: string, body: unknown) {
		return auth.handler(
			new Request(`http://127.0.0.1:3102/api/auth/${path}`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://127.0.0.1:3100",
				},
				body: JSON.stringify(body),
			}),
		);
	}

	beforeAll(async () => {
		const url = process.env.DATABASE_URL;
		if (
			!url ||
			!["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
		) {
			throw new Error("Run the isolated local-access harness.");
		}
		db = (await import("@crm/db")).db;
		if ((await db.user.count()) !== 0)
			throw new Error("The test requires an empty isolated database.");
		auth = (await import("../src/auth")).auth;
		provisionUser = (await import("../src/provision-user")).provisionUser;
	});

	afterAll(async () => {
		await db?.$disconnect();
	});

	it("provisions one owner, credential and explicit membership", async () => {
		const result = await provisionUser(owner);
		ownerId = result.user.id;
		expect(result.role).toBe("owner");
		expect(await db.user.count()).toBe(1);
		const account = await db.account.findFirst({
			where: { userId: ownerId, providerId: "credential" },
		});
		expect(account?.password).toBeTruthy();
		expect(account?.password).not.toBe(owner.password);
		expect(
			await db.member.count({ where: { userId: ownerId, role: "owner" } }),
		).toBe(1);
		expect(
			(await db.user.findUnique({ where: { id: ownerId } }))?.emailVerified,
		).toBe(false);
	});

	it("refuses repeat bootstrap without replacing the first account", async () => {
		await expect(
			provisionUser({ ...owner, email: "other@example.test" }),
		).rejects.toThrow("empty installation");
		expect(await db.user.count()).toBe(1);
	});

	it("signs in through the real HTTP handler without a cloud provider", async () => {
		const response = await post("sign-in/email", {
			email: owner.email,
			password: owner.password,
			rememberMe: false,
		});
		expect(response.status).toBe(200);
		cookie = response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
		expect(cookie).toContain("crm.session_token=");
		const session = await auth.api.getSession({
			headers: new Headers({ cookie }),
		});
		expect(session?.user.id).toBe(ownerId);
		expect(session?.session.activeOrganizationId).toBe("workspace");
	});

	it("refuses incorrect passwords", async () => {
		const response = await post("sign-in/email", {
			email: owner.email,
			password: "Incorrect-Synthetic-Password",
		});
		expect(response.status).toBe(401);
	});

	it("refuses public registration even for an eligible address", async () => {
		const response = await post("sign-up/email", {
			...owner,
			email: "public@example.test",
		});
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(await db.user.count()).toBe(1);
	});

	it("never replaces an existing password during managed provisioning", async () => {
		const before = await db.account.findFirst({ where: { userId: ownerId } });
		await expect(
			provisionUser({ ...owner, bootstrap: false, role: "member" }),
		).rejects.toThrow("already exists");
		const after = await db.account.findFirst({ where: { userId: ownerId } });
		expect(after?.password).toBe(before?.password);
	});

	it("provisions additional accounts without promoting them to owner", async () => {
		const result = await provisionUser({
			...owner,
			email: "admin@example.test",
			bootstrap: false,
			role: "admin",
		});
		expect(result.role).toBe("admin");
		expect(await db.member.count({ where: { role: "owner" } })).toBe(1);
	});

	it("refuses an address outside the eligibility list", async () => {
		await expect(
			provisionUser({
				...owner,
				email: "outsider@outside.test",
				bootstrap: false,
				role: "member",
			}),
		).rejects.toThrow("ALLOWED_SIGN_IN");
		expect(await db.user.count()).toBe(2);
	});

	it("ends the session through the real sign-out handler", async () => {
		expect(cookie).toBeTruthy();
		const response = await auth.handler(
			new Request("http://127.0.0.1:3102/api/auth/sign-out", {
				method: "POST",
				headers: {
					cookie,
					origin: "http://127.0.0.1:3100",
					"content-type": "application/json",
				},
				body: "{}",
			}),
		);
		expect(response.status).toBe(200);
		expect(await db.session.count({ where: { userId: ownerId } })).toBe(0);
	});

	it("refuses reuse of the signed-out session cookie", async () => {
		expect(cookie).toBeTruthy();
		const session = await auth.api.getSession({
			headers: new Headers({ cookie }),
		});
		expect(session).toBeNull();
	});

	it("refuses login without membership and never reenrolls the account", async () => {
		await db.member.deleteMany({ where: { userId: ownerId } });
		const response = await post("sign-in/email", {
			email: owner.email,
			password: owner.password,
		});
		expect(response.status).toBe(403);
		expect(await db.member.count({ where: { userId: ownerId } })).toBe(0);
		expect(await db.session.count({ where: { userId: ownerId } })).toBe(0);
	});
});
