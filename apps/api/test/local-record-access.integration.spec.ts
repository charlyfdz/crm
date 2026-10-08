import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import "reflect-metadata";
import type { Db } from "@crm/db";
import type { INestApplication } from "@nestjs/common";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import type { CompaniesService } from "../src/companies/companies.service";
import type { ContactsService } from "../src/contacts/contacts.service";

const suite =
	process.env.CRM_RECORD_ACCESS_TEST === "1" ? describe : describe.skip;

async function provisionRecordActors(
	db: Db,
	users: Map<string, string>,
	sessions: Map<string, string>,
) {
	const { auth, provisionUser } = await import("@crm/auth");
	const password = "Synthet1c-Records-Password";
	for (const [name, role] of [
		["owner", "owner"],
		["admin", "admin"],
		["rep", "member"],
		["other", "member"],
		["suspended", "member"],
		["unknown", "member"],
	] as const) {
		const result = await provisionUser(
			{
				name: `Ficticio ${name}`,
				email: `${name}@example.test`,
				password,
				role,
				bootstrap: name === "owner",
			},
			db,
			users.get("owner"),
		);
		users.set(name, result.user.id);
		await db.rateLimit.deleteMany();
		const response = await auth.handler(
			new Request("http://127.0.0.1:3102/api/auth/sign-in/email", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://127.0.0.1:3100",
				},
				body: JSON.stringify({ email: `${name}@example.test`, password }),
			}),
		);
		expect(response.ok).toBe(true);
		sessions.set(
			name,
			response.headers
				.getSetCookie()
				.map((cookie) => cookie.split(";")[0])
				.join("; "),
		);
	}
}

type QueueFixture = {
	db: Db;
	companies: CompaniesService;
	contacts: ContactsService;
	agent: AgentTriggerService;
	user: (name: string) => string;
};

function recordHttp(
	fetchLocal: typeof globalThis.fetch,
	origin: () => string,
	sessions: Map<string, string>,
) {
	return (path: string, input: unknown, actor = "rep", query = false) =>
		fetchLocal(
			`${origin()}/api/trpc/${path}${query ? `?input=${encodeURIComponent(JSON.stringify(input))}` : ""}`,
			{
				method: query ? "GET" : "POST",
				headers: {
					"content-type": "application/json",
					cookie: sessions.get(actor) ?? "",
				},
				...(!query ? { body: JSON.stringify(input) } : {}),
			},
		);
}

function recordQueueTests(fixture: () => QueueFixture) {
	for (const kind of ["company", "contact"] as const) {
		it(`${kind} queue failure rolls back real task inserts and record status`, async () => {
			const { db, companies, contacts, agent, user } = fixture();
			const record =
				kind === "company"
					? await companies.create({ name: "Cola ficticia" }, user("rep"))
					: await contacts.create(
							{ firstName: "Cola ficticia", companyId: null },
							user("rep"),
						);
			const before =
				kind === "company"
					? await db.company.findUniqueOrThrow({ where: { id: record.id } })
					: await db.contact.findUniqueOrThrow({ where: { id: record.id } });
			const tasksBefore = await db.agentTask.count();
			const drain = spyOn(agent, "drainQueues").mockImplementation(() => {});
			const requested = agent.companyRequested.bind(agent);
			const identified = agent.contactCreated.bind(agent);
			const queued =
				kind === "company"
					? spyOn(agent, "companyRequested").mockImplementation(
							async (...args) => {
								await requested(...args);
								throw new Error("Synthetic queue failure after insert.");
							},
						)
					: spyOn(agent, "contactCreated").mockImplementation(
							async (...args) => {
								await identified(...args);
								throw new Error("Synthetic queue failure after insert.");
							},
						);
			process.env.CRM_AI_ENABLED = "true";
			try {
				const service = kind === "company" ? companies : contacts;
				await expect(service.enrich(record.id, user("rep"))).rejects.toThrow(
					"Synthetic queue failure",
				);
				expect(queued).toHaveBeenCalledTimes(1);
				expect(drain).not.toHaveBeenCalled();
				expect(await db.agentTask.count()).toBe(tasksBefore);
				expect(
					kind === "company"
						? await db.company.findUniqueOrThrow({ where: { id: record.id } })
						: await db.contact.findUniqueOrThrow({ where: { id: record.id } }),
				).toEqual(before);
			} finally {
				process.env.CRM_AI_ENABLED = "false";
				queued.mockRestore();
				drain.mockRestore();
			}
		});
	}
	it("enabled manual queues deny foreign owners and commit only authorized requests", async () => {
		const { db, companies, contacts, agent, user } = fixture();
		const company = await companies.create(
			{ name: "Solicitud ficticia", domain: "queue.example.test" },
			user("rep"),
		);
		const contact = await contacts.create(
			{ firstName: "Solicitud ficticia", companyId: company.id },
			user("rep"),
		);
		const count = await db.agentTask.count();
		const drain = spyOn(agent, "drainQueues").mockImplementation(() => {});
		process.env.CRM_AI_ENABLED = "true";
		try {
			await expect(
				companies.research(company.id, user("other")),
			).rejects.toThrow("permiso");
			await expect(contacts.enrich(contact.id, user("other"))).rejects.toThrow(
				"permiso",
			);
			expect(await db.agentTask.count()).toBe(count);
			expect(drain).not.toHaveBeenCalled();
			expect((await companies.enrich(company.id, user("rep"))).queued).toBe(
				true,
			);
			expect((await contacts.enrich(contact.id, user("rep"))).queued).toBe(
				true,
			);
			expect(await db.agentTask.count()).toBe(count + 3);
			expect(
				(await db.company.findUniqueOrThrow({ where: { id: company.id } }))
					.enrichmentStatus,
			).toBe("PENDING");
			expect(
				(await db.contact.findUniqueOrThrow({ where: { id: contact.id } }))
					.enrichmentStatus,
			).toBe("PENDING");
			expect(drain).toHaveBeenCalledTimes(2);
		} finally {
			process.env.CRM_AI_ENABLED = "false";
			drain.mockRestore();
		}
	});
}

suite("disposable company and contact authorization", () => {
	let db: Db;
	let companies: CompaniesService;
	let contacts: ContactsService;
	let agent: AgentTriggerService;
	let application: INestApplication | undefined;
	let origin: string;
	let blockedCalls = 0;
	const fetchLocal = globalThis.fetch;
	const users = new Map<string, string>();
	const sessions = new Map<string, string>();
	const user = (name: string) => {
		const id = users.get(name);
		if (!id) throw new Error("Unknown synthetic actor.");
		return id;
	};
	beforeAll(async () => {
		const url = new URL(process.env.DATABASE_URL ?? "");
		if (
			url.hostname !== "127.0.0.1" ||
			!url.port ||
			url.pathname !== "/crm_record_access_test" ||
			process.env.TEST_DATABASE_URL !== url.toString() ||
			process.env.CRM_AI_ENABLED !== "false"
		)
			throw new Error("Use test:record-access with its disposable fixture.");
		globalThis.fetch = Object.assign(
			async () => {
				blockedCalls++;
				throw new Error("External calls forbidden.");
			},
			{ preconnect: fetchLocal.preconnect },
		);
		db = (await import("@crm/db")).db;
		if (await db.user.count()) throw new Error("Record fixture must be empty.");
		await provisionRecordActors(db, users, sessions);
		await db.member.updateMany({
			where: { userId: user("suspended") },
			data: { suspendedAt: new Date() },
		});
		await db.member.updateMany({
			where: { userId: user("unknown") },
			data: { role: "viewer" },
		});
		await db.user.create({
			data: {
				id: "outsider",
				name: "Ficticio externo",
				email: "outsider@example.test",
			},
		});
		const { AgentTriggerService } = await import(
			"../src/agent/agent-trigger.service"
		);
		const { AgentQueueService } = await import(
			"../src/agent/agent-queue.service"
		);
		const { ActivityStampService } = await import(
			"../src/crm/activity-stamp.service"
		);
		const { ConversionService } = await import(
			"../src/currency/conversion.service"
		);
		const { FieldsService } = await import("../src/fields/fields.service");
		const { CompanyDirectoryService } = await import(
			"../src/companies/company-directory.service"
		);
		const { CompaniesService: CompanyService } = await import(
			"../src/companies/companies.service"
		);
		const { ContactsService: ContactService } = await import(
			"../src/contacts/contacts.service"
		);
		agent = new AgentTriggerService(db);
		const stamp = new ActivityStampService(db);
		const queue = new AgentQueueService(db);
		const fields = new FieldsService(db, agent);
		companies = new CompanyService(
			db,
			agent,
			queue,
			{
				backfill: async () => {
					throw new Error("Automatic favicon disabled.");
				},
			} as unknown as import("../src/companies/favicon.service").FaviconService,
			stamp,
			new ConversionService(db),
			fields,
		);
		contacts = new ContactService(
			db,
			new CompanyDirectoryService(agent),
			agent,
			queue,
			stamp,
			fields,
		);
		const { Test } = await import("@nestjs/testing");
		const { DatabaseModule } = await import("../src/database/database.module");
		const { TrpcModule } = await import("../src/trpc/trpc.module");
		const { CompaniesRouter } = await import(
			"../src/companies/companies.router"
		);
		const { ContactsRouter } = await import("../src/contacts/contacts.router");
		const module = await Test.createTestingModule({
			imports: [DatabaseModule, TrpcModule],
			providers: [
				CompaniesRouter,
				ContactsRouter,
				{ provide: CompanyService, useValue: companies },
				{ provide: ContactService, useValue: contacts },
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
			throw new Error("HTTP fixture must be loopback-only.");
		origin = `http://127.0.0.1:${address.port}`;
	});
	afterAll(async () => {
		await application?.close();
		if (origin)
			await expect(
				fetchLocal(`${origin}/api/trpc/companies.list`),
			).rejects.toThrow();
		globalThis.fetch = fetchLocal;
		await db?.$disconnect();
	});
	const http = recordHttp(fetchLocal, () => origin, sessions);

	for (const kind of ["company", "contact"] as const) {
		let id: string;
		const create = (owner = "rep") =>
			kind === "company"
				? companies.create({ name: "Empresa ficticia" }, user(owner))
				: contacts.create(
						{ firstName: "Contacto ficticio", companyId: null },
						user(owner),
					);
		const service = () => (kind === "company" ? companies : contacts);
		it(`${kind}: defaults creation to authenticated owner`, async () => {
			id = (await create()).id;
			const row =
				kind === "company"
					? await db.company.findUniqueOrThrow({ where: { id } })
					: await db.contact.findUniqueOrThrow({ where: { id } });
			expect(row.ownerId).toBe(user("rep"));
		});
		it(`${kind}: reads another owner's shared record`, async () => {
			expect((await service().byId(id, user("other"))).id).toBe(id);
		});
		it(`${kind}: rejects missing and unsupported actors`, async () => {
			for (const actor of [
				"",
				"outsider",
				user("unknown"),
				user("suspended"),
			]) {
				await expect(service().byId(id, actor)).rejects.toThrow(
					/identidad|permiso/,
				);
			}
		});
		it(`${kind}: refuses foreign writes and forged actor fields over HTTP`, async () => {
			const before = await service().byId(id, user("owner"));
			const route = kind === "company" ? "companies" : "contacts";
			const input =
				kind === "company"
					? { name: "No permitido" }
					: { firstName: "No permitido" };
			const response = await http(
				`${route}.update`,
				{
					id,
					data: { ...input, actingUserId: user("rep") },
					userId: user("rep"),
				},
				"other",
			);
			expect(response.status).toBe(403);
			expect(await service().byId(id, user("owner"))).toEqual(before);
		});
		it(`${kind}: rejects member reassignment and clearing owner`, async () => {
			for (const ownerId of [null, user("other")]) {
				if (kind === "company")
					await expect(
						companies.update(id, { ownerId }, user("rep")),
					).rejects.toThrow("reasignar");
				else
					await expect(
						contacts.update(id, { ownerId }, user("rep")),
					).rejects.toThrow("reasignar");
			}
		});
		it(`${kind}: rejects inactive assignment before custom fields change`, async () => {
			if (kind === "company")
				await expect(
					companies.update(
						id,
						{ ownerId: user("suspended"), fields: { invalid: "not saved" } },
						user("admin"),
					),
				).rejects.toThrow("permiso");
			else
				await expect(
					contacts.update(
						id,
						{ ownerId: user("suspended"), fields: { invalid: "not saved" } },
						user("admin"),
					),
				).rejects.toThrow("permiso");
			expect(
				await db.fieldValue.count({
					where: kind === "company" ? { companyId: id } : { contactId: id },
				}),
			).toBe(0);
		});
		it(`${kind}: prohibits deletion of an active record`, async () => {
			await expect(service().purge(id, user("owner"))).rejects.toThrow(
				"Archiva",
			);
			await expect(service().purge(id, user("admin"))).rejects.toThrow(
				"propietario",
			);
		});
		it(`${kind}: mixed-owner bulk archives only authorized rows and deduplicates`, async () => {
			const foreign = (await create("other")).id;
			const result = await service().bulkArchive(
				[id, id, foreign],
				user("rep"),
			);
			expect(result).toMatchObject({
				requested: 2,
				succeeded: 1,
				failed: 1,
				skipped: 0,
			});
			expect(
				(await service().byId(foreign, user("owner"))).archivedAt,
			).toBeNull();
		});
		it(`${kind}: repeated archive retains first retention date`, async () => {
			const first = (await service().byId(id, user("rep"))).archivedAt;
			await service().archive(id, user("rep"));
			expect((await service().byId(id, user("rep"))).archivedAt).toBe(first);
		});
		it(`${kind}: archived records refuse edits and restore succeeds for owner`, async () => {
			if (kind === "company")
				await expect(
					companies.update(id, { name: "No guardado" }, user("rep")),
				).rejects.toThrow("Restaura");
			else
				await expect(
					contacts.update(id, { firstName: "No guardado" }, user("rep")),
				).rejects.toThrow("Restaura");
			await expect(service().restore(id, user("other"))).rejects.toThrow(
				"permiso",
			);
			await service().restore(id, user("rep"));
			expect((await service().byId(id, user("rep"))).archivedAt).toBeNull();
		});
		it(`${kind}: denies bulk reassignment and purge to members`, async () => {
			await expect(
				service().bulkAssignOwner(
					{ ids: [id], ownerId: user("other") },
					user("rep"),
				),
			).rejects.toThrow("permiso");
			await expect(service().bulkPurge([id], user("rep"))).rejects.toThrow(
				"permiso",
			);
		});
		it(`${kind}: owner purges an archived record`, async () => {
			await service().archive(id, user("rep"));
			expect((await service().purge(id, user("owner"))).id).toBe(id);
			await expect(service().byId(id, user("owner"))).rejects.toThrow();
		});
		it(`${kind}: unassigned record is readable but not claimable by members`, async () => {
			const result =
				kind === "company"
					? await companies.create(
							{ name: "Sin responsable", ownerId: null },
							user("admin"),
						)
					: await contacts.create(
							{ firstName: "Sin responsable", ownerId: null, companyId: null },
							user("admin"),
						);
			await expect(service().archive(result.id, user("rep"))).rejects.toThrow(
				"permiso",
			);
			const assignment = await service().bulkAssignOwner(
				{ ids: [result.id], ownerId: user("rep") },
				user("admin"),
			);
			expect(assignment.succeeded).toBe(1);
			await service().archive(result.id, user("rep"));
		});
	}

	it("rejects unauthorized contact creation without an automatic company", async () => {
		const count = await db.company.count();
		await expect(
			contacts.create(
				{
					firstName: "No permitido",
					email: "no@unapproved.example.test",
					ownerId: user("other"),
				},
				user("rep"),
			),
		).rejects.toThrow("reasignar");
		expect(await db.company.count()).toBe(count);
	});
	it("creates domain company and contact with the same current owner", async () => {
		const contact = await contacts.create(
			{ firstName: "Auto ficticio", email: "auto@synthetic.example.test" },
			user("rep"),
		);
		const row = await db.contact.findUniqueOrThrow({
			where: { id: contact.id },
			include: { company: true },
		});
		expect(row.ownerId).toBe(user("rep"));
		expect(row.company?.ownerId).toBe(user("rep"));
	});
	it("explicit null company remains unassociated despite a corporate email", async () => {
		const result = await contacts.create(
			{
				firstName: "No asociación",
				email: "none@null.example.test",
				companyId: null,
			},
			user("rep"),
		);
		expect(
			(await db.contact.findUniqueOrThrow({ where: { id: result.id } }))
				.companyId,
		).toBeNull();
		expect(
			await db.company.count({ where: { domain: "null.example.test" } }),
		).toBe(0);
	});
	it("rejects linking a new contact to an archived company", async () => {
		const company = await companies.create({ name: "Archivada" }, user("rep"));
		await companies.archive(company.id, user("rep"));
		await expect(
			contacts.create(
				{ firstName: "No asociado", companyId: company.id },
				user("rep"),
			),
		).rejects.toThrow("activa");
	});
	it("primary contacts stay active and attached until explicit unlink", async () => {
		const company = await companies.create(
			{ name: "Principal ficticia" },
			user("rep"),
		);
		const destination = await companies.create(
			{ name: "Destino ficticio" },
			user("other"),
		);
		const contact = await contacts.create(
			{ firstName: "Principal", companyId: company.id },
			user("rep"),
		);
		await expect(
			companies.setPrimaryContact(company.id, contact.id, user("other")),
		).rejects.toThrow("permiso");
		await companies.setPrimaryContact(company.id, contact.id, user("rep"));
		await expect(
			contacts.update(contact.id, { companyId: destination.id }, user("rep")),
		).rejects.toThrow("vínculos");
		await expect(contacts.archive(contact.id, user("rep"))).rejects.toThrow(
			"principal",
		);
		await companies.setPrimaryContact(company.id, null, user("rep"));
		await contacts.update(
			contact.id,
			{ companyId: destination.id },
			user("rep"),
		);
		await expect(
			companies.setPrimaryContact(company.id, contact.id, user("rep")),
		).rejects.toThrow("misma empresa");
		await contacts.archive(contact.id, user("rep"));
		await expect(
			companies.setPrimaryContact(destination.id, contact.id, user("other")),
		).rejects.toThrow("activo");
	});
	it("linked opportunities prevent contact relocation without authorized unlink", async () => {
		const company = await companies.create(
			{ name: "Con oportunidad" },
			user("rep"),
		);
		const contact = await contacts.create(
			{ firstName: "Vinculado", companyId: company.id },
			user("rep"),
		);
		const deal = await db.deal.create({
			data: { name: "Ficticia", companyId: company.id, ownerId: user("rep") },
		});
		await db.dealContact.create({
			data: { dealId: deal.id, contactId: contact.id },
		});
		const bulk = await contacts.bulkSetCompany(
			{ ids: [contact.id], companyId: null },
			user("rep"),
		);
		expect(bulk).toMatchObject({ succeeded: 0, failed: 1 });
		expect(
			(await db.contact.findUniqueOrThrow({ where: { id: contact.id } }))
				.companyId,
		).toBe(company.id);
		await companies.archive(company.id, user("rep"));
		await expect(companies.purge(company.id, user("owner"))).rejects.toThrow(
			"oportunidades",
		);
		await db.deal.update({
			where: { id: deal.id },
			data: { archivedAt: new Date() },
		});
		await companies.purge(company.id, user("owner"));
		expect(await db.deal.findUnique({ where: { id: deal.id } })).toBeNull();
		expect(
			(await db.contact.findUniqueOrThrow({ where: { id: contact.id } }))
				.companyId,
		).toBeNull();
	});
	it("suggestion decisions check ownership and current proposal state", async () => {
		const contact = await contacts.create(
			{ firstName: "Sugerencia" },
			user("rep"),
		);
		const fact = await db.contactFact.create({
			data: {
				contactId: contact.id,
				field: "title",
				value: "Dato ficticio",
				score: 0.7,
				band: "PROBABLE",
				evidence: [],
				method: "fixture",
				status: "PROPOSED",
			},
		});
		await expect(
			contacts.decideFact(
				{ factId: fact.id, decision: "accept" },
				user("other"),
			),
		).rejects.toThrow("permiso");
		expect(
			(await db.contactFact.findUniqueOrThrow({ where: { id: fact.id } }))
				.status,
		).toBe("PROPOSED");
		await contacts.decideFact(
			{ factId: fact.id, decision: "accept" },
			user("rep"),
		);
		expect(
			(await db.contact.findUniqueOrThrow({ where: { id: contact.id } })).title,
		).toBe("Dato ficticio");
		await expect(
			contacts.decideFact(
				{ factId: fact.id, decision: "dismiss" },
				user("rep"),
			),
		).rejects.toThrow("settled");
	});
	it("HTTP queries and CRUD preserve session identity and domain results", async () => {
		for (const [route, input] of [
			["companies.create", { name: "HTTP ficticia" }],
			["contacts.create", { firstName: "HTTP ficticio", companyId: null }],
		] as const) {
			const response = await http(route, input);
			expect(response.status).toBe(200);
			const result = (await response.json()) as {
				result: { data: { id: string } };
			};
			const id = result.result.data.id;
			const prefix = route.split(".")[0];
			expect((await http(`${prefix}.byId`, { id }, "other", true)).status).toBe(
				200,
			);
			expect((await http(`${prefix}.archive`, { id })).status).toBe(200);
			expect((await http(`${prefix}.restore`, { id })).status).toBe(200);
			expect((await http(`${prefix}.archive`, { id })).status).toBe(200);
			expect((await http(`${prefix}.purge`, { id }, "admin")).status).toBe(403);
			expect((await http(`${prefix}.purge`, { id }, "owner")).status).toBe(200);
		}
		expect((await http("companies.options", {}, "rep", true)).status).toBe(200);
		expect((await http("companies.list", {}, "rep", true)).status).toBe(200);
		expect((await http("contacts.list", {}, "rep", true)).status).toBe(200);
	});
	it("suspended and unsupported sessions cannot read protected HTTP records", async () => {
		for (const actor of ["suspended", "unknown", "anonymous"])
			expect([401, 403]).toContain(
				(await http("companies.list", {}, actor, true)).status,
			);
	});
	it("HTTP bulk procedures use current authority for every selected row", async () => {
		for (const kind of ["company", "contact"] as const) {
			const prefix = kind === "company" ? "companies" : "contacts";
			const create = (actor: string) =>
				kind === "company"
					? companies.create({ name: "Selección HTTP" }, user(actor))
					: contacts.create(
							{ firstName: "Selección HTTP", companyId: null },
							user(actor),
						);
			const own = (await create("rep")).id;
			const other = (await create("other")).id;
			const before =
				kind === "company"
					? await db.company.findUniqueOrThrow({ where: { id: other } })
					: await db.contact.findUniqueOrThrow({ where: { id: other } });
			expect(
				(
					await http(`${prefix}.bulkAssignOwner`, {
						ids: [own, other],
						ownerId: user("rep"),
					})
				).status,
			).toBe(403);
			for (const action of ["bulkArchive", "bulkRestore"]) {
				const response = await http(`${prefix}.${action}`, {
					ids: [own, other],
				});
				expect(response.status).toBe(200);
				expect(await response.json()).toMatchObject({
					result: { data: { requested: 2, succeeded: 1, failed: 1 } },
				});
			}
			expect(
				(await http(`${prefix}.bulkPurge`, { ids: [own, other] })).status,
			).toBe(403);
			expect(
				kind === "company"
					? await db.company.findUniqueOrThrow({ where: { id: other } })
					: await db.contact.findUniqueOrThrow({ where: { id: other } }),
			).toEqual(before);
			expect(
				(
					await http(
						`${prefix}.bulkAssignOwner`,
						{ ids: [own, "missing"], ownerId: user("other") },
						"admin",
					)
				).status,
			).toBe(200);
		}
	});
	it("HTTP primary contact, company move, and suggestion decisions check record ownership", async () => {
		const company = await companies.create(
			{ name: "Relaciones HTTP" },
			user("other"),
		);
		const contact = await contacts.create(
			{ firstName: "Relaciones HTTP", companyId: company.id },
			user("other"),
		);
		expect(
			(
				await http("companies.setPrimaryContact", {
					companyId: company.id,
					contactId: contact.id,
				})
			).status,
		).toBe(403);
		const response = await http("contacts.bulkSetCompany", {
			ids: [contact.id],
			companyId: null,
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			result: { data: { succeeded: 0, failed: 1 } },
		});
		const fact = await db.contactFact.create({
			data: {
				contactId: contact.id,
				field: "title",
				value: "HTTP",
				score: 0.7,
				band: "PROBABLE",
				evidence: [],
				method: "fixture",
				status: "PROPOSED",
			},
		});
		expect(
			(
				await http("contacts.decideFact", {
					factId: fact.id,
					decision: "accept",
				})
			).status,
		).toBe(403);
		expect(
			(await db.contactFact.findUniqueOrThrow({ where: { id: fact.id } }))
				.status,
		).toBe("PROPOSED");
	});
	for (const kind of ["company", "contact"] as const) {
		it(`${kind}: trusted retention preserves active and recent records`, async () => {
			const create = () =>
				kind === "company"
					? companies.create({ name: "Retención ficticia" }, user("owner"))
					: contacts.create(
							{ firstName: "Retención ficticia", companyId: null },
							user("owner"),
						);
			const old = (await create()).id;
			const recent = (await create()).id;
			const active = (await create()).id;
			const date = new Date("2026-01-01T00:00:00Z");
			if (kind === "company") {
				await db.company.update({
					where: { id: old },
					data: { archivedAt: date },
				});
				await companies.archive(recent, user("owner"));
				const outcome = await companies.purgeExpired(
					new Date("2026-02-01T00:00:00Z"),
				);
				expect(outcome.succeeded).toBe(1);
				expect(await db.company.findUnique({ where: { id: old } })).toBeNull();
			} else {
				await db.contact.update({
					where: { id: old },
					data: { archivedAt: date },
				});
				await contacts.archive(recent, user("owner"));
				const outcome = await contacts.purgeExpired(
					new Date("2026-02-01T00:00:00Z"),
				);
				expect(outcome.succeeded).toBe(1);
				expect(await db.contact.findUnique({ where: { id: old } })).toBeNull();
			}
			const selected = kind === "company" ? companies : contacts;
			expect(
				(await selected.byId(active, user("owner"))).archivedAt,
			).toBeNull();
			expect(
				(await selected.byId(recent, user("owner"))).archivedAt,
			).not.toBeNull();
		});
	}
	it("restoring a contact requires an active linked company", async () => {
		const company = await companies.create(
			{ name: "Restauración ficticia" },
			user("rep"),
		);
		const contact = await contacts.create(
			{ firstName: "Restauración ficticia", companyId: company.id },
			user("rep"),
		);
		await contacts.archive(contact.id, user("rep"));
		await companies.archive(company.id, user("rep"));
		await expect(contacts.restore(contact.id, user("rep"))).rejects.toThrow(
			"activa",
		);
		expect(
			(await contacts.byId(contact.id, user("rep"))).archivedAt,
		).not.toBeNull();
		await companies.restore(company.id, user("rep"));
		await contacts.restore(contact.id, user("rep"));
	});
	it("current responsibility is checked after reassignment", async () => {
		const company = await companies.create(
			{ name: "Reasignación ficticia" },
			user("rep"),
		);
		await companies.update(
			company.id,
			{ ownerId: user("other") },
			user("admin"),
		);
		await expect(
			companies.update(company.id, { name: "No guardado" }, user("rep")),
		).rejects.toThrow("permiso");
		await companies.update(
			company.id,
			{ name: "Responsable nuevo" },
			user("other"),
		);
		expect((await companies.byId(company.id, user("rep"))).name).toBe(
			"Responsable nuevo",
		);
	});
	it("disabled research creates no task or external request", async () => {
		const company = await companies.create(
			{ name: "Sin IA", domain: "no-ai.example.test" },
			user("rep"),
		);
		const contact = await contacts.create(
			{ firstName: "Sin IA", companyId: company.id },
			user("rep"),
		);
		for (const path of [
			"companies.enrich",
			"companies.research",
			"contacts.enrich",
			"companies.bulkEnrich",
			"contacts.bulkEnrich",
		]) {
			const id = path.startsWith("companies") ? company.id : contact.id;
			expect(
				(await http(path, path.includes("bulk") ? { ids: [id] } : { id }))
					.status,
			).toBe(403);
		}
		expect(await db.agentTask.count()).toBe(0);
		expect(blockedCalls).toBe(0);
	});
	recordQueueTests(() => ({ db, companies, contacts, agent, user }));
});
