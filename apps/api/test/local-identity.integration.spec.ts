import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import "reflect-metadata";
import type { Auth } from "@crm/auth";
import type { Db } from "@crm/db";
import type { INestApplication } from "@nestjs/common";
import type { MiddlewareOptions } from "nestjs-trpc";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { AuthMiddleware } from "../src/trpc/middlewares/auth.middleware";
import type { WorkspaceService } from "../src/workspace/workspace.service";

const suite = process.env.CRM_IDENTITY_TEST === "1" ? describe : describe.skip;

async function signInFixture(
	db: Db,
	auth: Auth,
	email: string,
	password: string,
) {
	await db.rateLimit.deleteMany();
	return auth.handler(
		new Request("http://127.0.0.1:3102/api/auth/sign-in/email", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://127.0.0.1:3100",
			},
			body: JSON.stringify({ email, password }),
		}),
	);
}

async function guardedFixture(guard: AuthMiddleware, userId: string) {
	return guard.use({
		ctx: { session: { user: { id: userId } } },
		next: async ({ ctx }: { ctx?: Record<string, unknown> } = {}) => ({
			ok: true,
			data: ctx,
		}),
	} as unknown as MiddlewareOptions);
}

function cookies(response: Response) {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
}

suite("disposable corporate identity lifecycle", () => {
	let db: Db;
	let auth: Auth;
	let workspace: WorkspaceService;
	let guard: AuthMiddleware;
	let ownerId: string;
	let ownerMemberId: string;
	let adminId: string;
	let adminMemberId: string;
	let memberId: string;
	let memberUserId: string;
	let memberCookie: string;
	let memberKeyId: string;
	let memberKey: string;
	let application: INestApplication | undefined;
	let apiOrigin: string;
	let blockedCalls = 0;
	const password = "Synthet1c-Identity-Password";
	const originalFetch = globalThis.fetch;
	const list = {
		q: "",
		page: 1,
		pageSize: 25,
		sort: "",
		dir: "asc" as const,
		role: [],
		activeOnly: false,
	};

	const signIn = (email: string, credential = password) =>
		signInFixture(db, auth, email, credential);
	const guarded = (userId: string) => guardedFixture(guard, userId);

	beforeAll(async () => {
		const url = new URL(process.env.DATABASE_URL ?? "");
		if (
			url.hostname !== "127.0.0.1" ||
			!url.port ||
			url.pathname !== "/crm_identity_test" ||
			process.env.TEST_DATABASE_URL !== url.toString() ||
			process.env.CRM_AI_ENABLED !== "false"
		)
			throw new Error("Use test:identity and its isolated synthetic database.");
		globalThis.fetch = Object.assign(
			async () => {
				blockedCalls++;
				throw new Error("External calls forbidden.");
			},
			{ preconnect: originalFetch.preconnect },
		);
		db = (await import("@crm/db")).db;
		if (await db.user.count())
			throw new Error("Identity fixture must be empty.");
		const authentication = await import("@crm/auth");
		auth = authentication.auth;
		ownerId = (
			await authentication.provisionUser({
				name: "Propietario ficticio",
				email: "owner@example.test",
				password,
				bootstrap: true,
				role: "owner",
			})
		).user.id;
		ownerMemberId = (
			await db.member.findFirstOrThrow({ where: { userId: ownerId } })
		).id;
		const { WorkspaceService: Service } = await import(
			"../src/workspace/workspace.service"
		);
		workspace = new Service(db, {
			workspaceChanged: async () => {
				throw new Error("AI must stay disabled.");
			},
		} as unknown as AgentTriggerService);
		const { AuthMiddleware: Guard } = await import(
			"../src/trpc/middlewares/auth.middleware"
		);
		guard = new Guard(db);
		const { Test } = await import("@nestjs/testing");
		const { DatabaseModule } = await import("../src/database/database.module");
		const { TrpcModule } = await import("../src/trpc/trpc.module");
		const { WorkspaceRouter } = await import(
			"../src/workspace/workspace.router"
		);
		const { ApiKeysRouter } = await import("../src/api-keys/api-keys.router");
		const { ApiKeysService } = await import("../src/api-keys/api-keys.service");
		const module = await Test.createTestingModule({
			imports: [DatabaseModule, TrpcModule],
			providers: [
				WorkspaceRouter,
				ApiKeysRouter,
				ApiKeysService,
				{ provide: Service, useValue: workspace },
			],
		}).compile();
		application = module.createNestApplication();
		application.useLogger(false);
		await application.listen(0, "127.0.0.1");
		const address = application.getHttpServer().address();
		if (
			!address ||
			typeof address === "string" ||
			address.address !== "127.0.0.1"
		)
			throw new Error("HTTP fixture is not loopback-only.");
		apiOrigin = `http://127.0.0.1:${address.port}`;
	});
	afterAll(async () => {
		await application?.close();
		if (apiOrigin) {
			await expect(
				originalFetch(`${apiOrigin}/api/trpc/workspace.get`),
			).rejects.toThrow();
		}
		globalThis.fetch = originalFetch;
		await db?.$disconnect();
	});
	async function http(
		path: string,
		options?: { cookie?: string; apiKey?: string; input?: unknown },
	) {
		if (!apiOrigin) throw new Error("No isolated HTTP fixture.");
		return originalFetch(`${apiOrigin}/api/trpc/${path}`, {
			method: options?.input ? "POST" : "GET",
			headers: {
				"content-type": "application/json",
				...(options?.cookie ? { cookie: options.cookie } : {}),
				...(options?.apiKey ? { "x-api-key": options.apiKey } : {}),
			},
			...(options?.input ? { body: JSON.stringify(options.input) } : {}),
		});
	}

	it("records bootstrap without passwords or invented human actor", async () => {
		const audit = await db.identityAuditEvent.findFirstOrThrow();
		expect(audit.actorUserId).toBeNull();
		expect(audit.action).toBe("PROVISION_USER");
		expect(audit.reason).toBe("operator-bootstrap");
		expect(JSON.stringify(audit)).not.toContain(password);
	});
	it("owner provisions admin and admin provisions a local member", async () => {
		const admin = await workspace.createMember(ownerId, {
			name: "Admin ficticio",
			email: "admin@example.test",
			password,
			role: "admin",
		});
		adminId = admin.userId;
		adminMemberId = admin.id;
		const member = await workspace.createMember(adminId, {
			name: "Miembro ficticio",
			email: "member@example.test",
			password,
			role: "member",
		});
		memberId = member.id;
		memberUserId = member.userId;
		expect(member.suspendedAt).toBeNull();
		expect(
			(
				await db.identityAuditEvent.findFirstOrThrow({
					where: { targetUserId: memberUserId },
				})
			).actorUserId,
		).toBe(adminId);
	});
	it("denies member provisioning and admin privilege elevation", async () => {
		await expect(
			workspace.createMember(memberUserId, {
				name: "No",
				email: "no@example.test",
				password,
				role: "member",
			}),
		).rejects.toThrow("permiso");
		await expect(
			workspace.createMember(adminId, {
				name: "No",
				email: "no@example.test",
				password,
				role: "admin",
			}),
		).rejects.toThrow("permiso");
		expect(await db.user.count()).toBe(3);
	});
	it("denies administrator promotion and modification of privileged members", async () => {
		await expect(
			workspace.setMemberRole(adminId, { memberId, role: "owner" }),
		).rejects.toThrow("propietario");
		await expect(
			workspace.setMemberRole(adminId, { memberId, role: "admin" }),
		).rejects.toThrow("propietario");
		await expect(
			workspace.setMemberRole(adminId, {
				memberId: ownerMemberId,
				role: "member",
			}),
		).rejects.toThrow("propietario");
		await expect(
			workspace.setMemberStatus(adminId, {
				memberId: adminMemberId,
				suspended: true,
				reason: "Synthetic reason",
			}),
		).rejects.toThrow("propietario");
	});
	it("protects the last active owner from demotion and suspension", async () => {
		await expect(
			workspace.setMemberRole(ownerId, {
				memberId: ownerMemberId,
				role: "member",
			}),
		).rejects.toThrow("propietario activo");
		await expect(
			workspace.setMemberStatus(ownerId, {
				memberId: ownerMemberId,
				suspended: true,
				reason: "Synthetic",
			}),
		).rejects.toThrow("propietario activo");
		expect(await db.identityAuditEvent.count()).toBe(3);
	});
	it("creates a real local session and synthetic legacy API key", async () => {
		const response = await signIn("member@example.test");
		expect(response.status).toBe(200);
		memberCookie = cookies(response);
		const key = await auth.api.createApiKey({
			headers: new Headers({ cookie: memberCookie }),
			body: { name: "Synthetic legacy key", expiresIn: 86400 },
		});
		memberKey = key.key;
		memberKeyId = key.id;
		expect(
			(
				await auth.api.getSession({
					headers: new Headers({ "x-api-key": memberKey }),
				})
			)?.user.id,
		).toBe(memberUserId);
		expect((await guarded(memberUserId)).ok).toBe(true);
	});
	it("blocks raw organization and API-key HTTP bypasses", async () => {
		for (const path of [
			"organization/update-member-role",
			"organization/remove-member",
			"organization/leave",
			"api-key/create",
			"api-key/update",
			"api-key/delete",
		]) {
			const response = await auth.handler(
				new Request(`http://127.0.0.1:3102/api/auth/${path}`, {
					method: "POST",
					headers: {
						cookie: memberCookie,
						"content-type": "application/json",
						origin: "http://127.0.0.1:3100",
					},
					body: "{}",
				}),
			);
			expect(response.status).toBe(404);
		}
	});
	it("suspends member, revokes all sessions and disables keys atomically", async () => {
		const result = await workspace.setMemberStatus(adminId, {
			memberId,
			suspended: true,
			reason: "Prueba de baja",
		});
		expect(result.suspendedAt).toBeTruthy();
		expect(await db.session.count({ where: { userId: memberUserId } })).toBe(0);
		expect(
			(await db.apikey.findUniqueOrThrow({ where: { id: memberKeyId } }))
				.enabled,
		).toBe(false);
		expect(
			await auth.api.getSession({
				headers: new Headers({ cookie: memberCookie }),
			}),
		).toBeNull();
		await expect(
			auth.api.getSession({ headers: new Headers({ "x-api-key": memberKey }) }),
		).rejects.toThrow("disabled");
		await expect(guarded(memberUserId)).rejects.toThrow("acceso activo");
	});
	it("suspended login cannot create session or read workspace through services", async () => {
		expect((await signIn("member@example.test")).status).toBe(403);
		await expect(workspace.get(memberUserId)).rejects.toThrow(
			"membresía activa",
		);
		await expect(workspace.members(memberUserId, list)).rejects.toThrow(
			"membresía activa",
		);
	});
	it("assignment lists exclude suspended people while administrators can still inspect them", async () => {
		const active = await workspace.members(ownerId, {
			...list,
			activeOnly: true,
		});
		const all = await workspace.members(ownerId, list);
		expect(active.rows.some((row) => row.userId === memberUserId)).toBe(false);
		expect(active.facetCounts.role?.member ?? 0).toBe(0);
		expect(
			all.rows.find((row) => row.userId === memberUserId)?.suspendedAt,
		).toBeTruthy();
	});
	it("repeating suspension preserves date and produces no fake second event", async () => {
		const before = await db.member.findUniqueOrThrow({
			where: { id: memberId },
		});
		const count = await db.identityAuditEvent.count();
		await workspace.setMemberStatus(adminId, {
			memberId,
			suspended: true,
			reason: "Repeated",
		});
		expect(
			(
				await db.member.findUniqueOrThrow({ where: { id: memberId } })
			).suspendedAt?.toISOString(),
		).toBe(before.suspendedAt?.toISOString());
		expect(await db.identityAuditEvent.count()).toBe(count);
	});
	it("reactivation permits fresh login without resurrecting keys or cookies", async () => {
		await workspace.setMemberStatus(adminId, {
			memberId,
			suspended: false,
			reason: "Prueba de reingreso",
		});
		expect((await signIn("member@example.test")).status).toBe(200);
		expect(
			await auth.api.getSession({
				headers: new Headers({ cookie: memberCookie }),
			}),
		).toBeNull();
		expect(
			(await db.apikey.findUniqueOrThrow({ where: { id: memberKeyId } }))
				.enabled,
		).toBe(false);
	});
	it("role change requires fresh login and records old and new role", async () => {
		const result = await workspace.setMemberRole(ownerId, {
			memberId,
			role: "admin",
		});
		expect(result.role).toBe("admin");
		expect(await db.session.count({ where: { userId: memberUserId } })).toBe(0);
		const audit = await db.identityAuditEvent.findFirstOrThrow({
			where: { targetUserId: memberUserId, action: "CHANGE_ROLE" },
		});
		expect(audit.previousRole).toBe("member");
		expect(audit.nextRole).toBe("admin");
	});
	it("unknown roles fail closed without falling back to member", async () => {
		await db.member.update({
			where: { id: memberId },
			data: { role: "not-supported" },
		});
		await expect(guarded(memberUserId)).rejects.toThrow("acceso activo");
		expect((await signIn("member@example.test")).status).toBe(403);
		await workspace.setMemberRole(ownerId, { memberId, role: "member" });
	});
	it("administrator resets only an unprivileged local password and revokes access", async () => {
		const response = await signIn("member@example.test");
		const previousCookie = cookies(response);
		await expect(
			workspace.resetMemberPassword(adminId, {
				memberId: ownerMemberId,
				password: `${password}-New`,
				reason: "Synthetic",
			}),
		).rejects.toThrow("propietario");
		await workspace.resetMemberPassword(adminId, {
			memberId,
			password: `${password}-New`,
			reason: "Recuperación ficticia",
		});
		expect((await signIn("member@example.test")).status).toBe(401);
		expect(
			(await signIn("member@example.test", `${password}-New`)).status,
		).toBe(200);
		expect(
			await auth.api.getSession({
				headers: new Headers({ cookie: previousCookie }),
			}),
		).toBeNull();
		expect(
			JSON.stringify(await db.identityAuditEvent.findMany()),
		).not.toContain(password);
	});
	it("denies own administrative reset and missing local credential", async () => {
		await expect(
			workspace.resetMemberPassword(ownerId, {
				memberId: ownerMemberId,
				password,
				reason: "Synthetic",
			}),
		).rejects.toThrow("contraseña actual");
		await db.account.deleteMany({
			where: { userId: memberUserId, providerId: "credential" },
		});
		await expect(
			workspace.resetMemberPassword(adminId, {
				memberId,
				password,
				reason: "Synthetic",
			}),
		).rejects.toThrow("contraseña local");
	});
	it("suspended owners do not satisfy the active-owner invariant", async () => {
		await workspace.setMemberRole(ownerId, { memberId, role: "owner" });
		await workspace.setMemberStatus(ownerId, {
			memberId,
			suspended: true,
			reason: "Synthetic",
		});
		await expect(
			workspace.setMemberRole(ownerId, {
				memberId: ownerMemberId,
				role: "member",
			}),
		).rejects.toThrow("propietario activo");
	});
	it("denies nonmanagers access to identity audit and exposes no credentials", async () => {
		await workspace.setMemberRole(ownerId, { memberId, role: "member" });
		await workspace.setMemberStatus(ownerId, {
			memberId,
			suspended: false,
			reason: "Synthetic",
		});
		await expect(workspace.identityAudit(memberUserId, list)).rejects.toThrow(
			"auditoría",
		);
		const receipt = await workspace.identityAudit(ownerId, list);
		expect(receipt.total).toBeGreaterThan(3);
		expect(JSON.stringify(receipt)).not.toContain(password);
	});
	it("database rejects ordinary audit edits and deletions", async () => {
		const row = await db.identityAuditEvent.findFirstOrThrow();
		await expect(
			(async () =>
				db.identityAuditEvent.update({
					where: { id: row.id },
					data: { reason: "rewrite" },
				}))(),
		).rejects.toThrow("append-only");
		await expect(
			(async () => db.identityAuditEvent.delete({ where: { id: row.id } }))(),
		).rejects.toThrow("append-only");
	});
	it("serializes competing owner demotions in the disposable fixture", async () => {
		await workspace.setMemberRole(ownerId, { memberId, role: "owner" });
		const results = await Promise.allSettled([
			workspace.setMemberRole(ownerId, {
				memberId: ownerMemberId,
				role: "member",
			}),
			workspace.setMemberRole(memberUserId, { memberId, role: "member" }),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		const owners = await db.member.findMany({
			where: { role: "owner", suspendedAt: null },
		});
		expect(owners).toHaveLength(1);
		const actor = owners[0]?.userId;
		if (!actor) throw new Error("Synthetic invariant broken.");
		await workspace.setMemberRole(actor, {
			memberId: ownerMemberId,
			role: "owner",
		});
		await workspace.setMemberRole(ownerId, { memberId, role: "member" });
	});
	it("API-key management requires elevated membership and finite expiration", async () => {
		const { ApiKeysService } = await import("../src/api-keys/api-keys.service");
		const keys = new ApiKeysService(db);
		await expect(keys.list(memberUserId, list)).rejects.toThrow("propietarios");
		await expect(
			keys.create(memberUserId, new Headers(), {
				name: "Denied",
				expiresInDays: 30,
			}),
		).rejects.toThrow("propietarios");
		const { createApiKeyInput } = await import(
			"../src/api-keys/api-keys.contracts"
		);
		expect(
			createApiKeyInput.safeParse({ name: "Denied", expiresInDays: null })
				.success,
		).toBe(false);
		expect(
			createApiKeyInput.safeParse({ name: "Denied", expiresInDays: 366 })
				.success,
		).toBe(false);
	});
	it("does not disclose a key if the manager is suspended while it is being created", async () => {
		const { ApiKeysService } = await import("../src/api-keys/api-keys.service");
		const keys = new ApiKeysService(db);
		const response = await signIn("admin@example.test");
		const originalCreate = auth.api.createApiKey;
		let newKeyId: string | undefined;
		const intercepted = spyOn(auth.api, "createApiKey").mockImplementation(
			(async (...args: Parameters<typeof originalCreate>) => {
				const created = await originalCreate(...args);
				newKeyId = created.id;
				await workspace.setMemberStatus(ownerId, {
					memberId: adminMemberId,
					suspended: true,
					reason: "Synthetic interleaving",
				});
				return created;
			}) as typeof originalCreate,
		);
		try {
			await expect(
				keys.create(adminId, new Headers({ cookie: cookies(response) }), {
					name: "Synthetic race key",
					expiresInDays: 30,
				}),
			).rejects.toThrow("desactivada");
			if (!newKeyId) throw new Error("Synthetic key missing.");
			expect(
				(await db.apikey.findUniqueOrThrow({ where: { id: newKeyId } }))
					.enabled,
			).toBe(false);
		} finally {
			intercepted.mockRestore();
			await workspace.setMemberStatus(ownerId, {
				memberId: adminMemberId,
				suspended: false,
				reason: "Synthetic restore",
			});
		}
	});
	it("actual HTTP middleware rejects anonymous and unsupported identities", async () => {
		expect((await http("workspace.get")).status).toBe(401);
		const response = await signIn("owner@example.test");
		expect(
			(await http("workspace.get", { cookie: cookies(response) })).status,
		).toBe(200);
	});
	it("actual HTTP denies privilege promotion and forged provisioning identity", async () => {
		const adminResponse = await signIn("admin@example.test");
		const adminCookie = cookies(adminResponse);
		expect(
			(
				await http("workspace.setMemberRole", {
					cookie: adminCookie,
					input: { memberId, role: "owner" },
				})
			).status,
		).toBe(403);
		expect(
			(
				await http("workspace.createMember", {
					cookie: adminCookie,
					input: {
						name: "Forge",
						email: "forged@example.test",
						password,
						role: "admin",
						actingUserId: ownerId,
					},
				})
			).status,
		).toBe(400);
		expect(
			await db.user.count({ where: { email: "forged@example.test" } }),
		).toBe(0);
	});
	it("actual HTTP refuses identity management by API key, even for owner", async () => {
		const response = await signIn("owner@example.test");
		const key = await auth.api.createApiKey({
			headers: new Headers({ cookie: cookies(response) }),
			body: { name: "Synthetic owner key", expiresIn: 86400 },
		});
		expect((await http("workspace.get", { apiKey: key.key })).status).toBe(200);
		expect(
			(
				await http("workspace.setMemberStatus", {
					apiKey: key.key,
					input: { memberId, suspended: true, reason: "Synthetic denial" },
				})
			).status,
		).toBe(401);
		expect(
			(await db.member.findUniqueOrThrow({ where: { id: memberId } }))
				.suspendedAt,
		).toBeNull();
	});
	it("actual HTTP revalidates membership and rejects revoked cookies after suspension", async () => {
		const response = await signIn("admin@example.test");
		const beforeCookie = cookies(response);
		expect((await http("workspace.get", { cookie: beforeCookie })).status).toBe(
			200,
		);
		await workspace.setMemberStatus(ownerId, {
			memberId: adminMemberId,
			suspended: true,
			reason: "Synthetic HTTP revocation",
		});
		expect((await http("workspace.get", { cookie: beforeCookie })).status).toBe(
			401,
		);
		await workspace.setMemberStatus(ownerId, {
			memberId: adminMemberId,
			suspended: false,
			reason: "Synthetic restore",
		});
		expect((await http("workspace.get", { cookie: beforeCookie })).status).toBe(
			401,
		);
	});
	it("workspace settings require a human session and preserve metadata without AI", async () => {
		await db.organization.update({
			where: { id: "workspace" },
			data: { metadata: JSON.stringify({ retained: "synthetic" }) },
		});
		const response = await signIn("owner@example.test");
		const cookie = cookies(response);
		const key = await auth.api.createApiKey({
			headers: new Headers({ cookie }),
			body: { name: "Synthetic configuration key", expiresIn: 86400 },
		});
		const input = {
			name: "Empresa ficticia",
			website: "https://example.test",
			slug: "empresa-ficticia",
		};
		expect(
			(await http("workspace.update", { apiKey: key.key, input })).status,
		).toBe(401);
		expect((await http("workspace.update", { cookie, input })).status).toBe(
			200,
		);
		const result = await workspace.get(ownerId);
		expect(result.name).toBe(input.name);
		expect(result.slug).toBe(input.slug);
		expect(result.website).toBe("example.test");
		expect(result.onboarded).toBe(true);
		expect(
			JSON.parse(
				(
					await db.organization.findUniqueOrThrow({
						where: { id: "workspace" },
					})
				).metadata ?? "{}",
			).retained,
		).toBe("synthetic");
		expect(await db.agentTask.count()).toBe(0);
	});
	it("workspace settings deny ordinary members without modifying the company", async () => {
		const before = await db.organization.findUniqueOrThrow({
			where: { id: "workspace" },
		});
		await expect(
			workspace.update(memberUserId, {
				name: "Denied",
				website: "example.test",
			}),
		).rejects.toThrow("administrador");
		expect(
			(await db.organization.findUniqueOrThrow({ where: { id: "workspace" } }))
				.name,
		).toBe(before.name);
	});
	it("workspace settings recheck authority inside the write transaction after suspension", async () => {
		const before = await db.organization.findUniqueOrThrow({
			where: { id: "workspace" },
		});
		const nativeTransaction = db.$transaction.bind(db);
		let entered = false;
		const intercepted = new Proxy(db, {
			get(target, property) {
				if (property === "$transaction")
					return async (...args: Parameters<typeof nativeTransaction>) => {
						entered = true;
						await workspace.setMemberStatus(ownerId, {
							memberId: adminMemberId,
							suspended: true,
							reason: "Synthetic configuration interleaving",
						});
						return nativeTransaction(...args);
					};
				const value = Reflect.get(target, property);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		const { WorkspaceService: Service } = await import(
			"../src/workspace/workspace.service"
		);
		const isolated = new Service(intercepted, {
			workspaceChanged: async () => {
				throw new Error("AI must stay disabled.");
			},
		} as unknown as AgentTriggerService);
		try {
			await expect(
				isolated.update(adminId, {
					name: "Denied race",
					website: "example.test",
				}),
			).rejects.toThrow("administrador");
			expect(entered).toBe(true);
			expect(
				(
					await db.organization.findUniqueOrThrow({
						where: { id: "workspace" },
					})
				).name,
			).toBe(before.name);
		} finally {
			await workspace.setMemberStatus(ownerId, {
				memberId: adminMemberId,
				suspended: false,
				reason: "Synthetic restore",
			});
		}
	});
	it("does not bootstrap workspace membership from a read or contact a provider", async () => {
		await db.user.create({
			data: {
				id: "outsider",
				name: "Ficticio",
				email: "outsider@example.test",
			},
		});
		await expect(workspace.get("outsider")).rejects.toThrow("membresía activa");
		expect(await db.member.count({ where: { userId: "outsider" } })).toBe(0);
		expect(blockedCalls).toBe(0);
	});
});
