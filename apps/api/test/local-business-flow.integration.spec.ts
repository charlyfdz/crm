import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Db } from "@crm/db";
import type { ActivitiesService } from "../src/activities/activities.service";
import type { ConversionService } from "../src/currency/conversion.service";
import type { DashboardService } from "../src/dashboard/dashboard.service";
import type { DealsService } from "../src/deals/deals.service";
import type { PipelinesService } from "../src/pipelines/pipelines.service";

const integration =
	process.env.CRM_BUSINESS_FLOW_TEST === "1" ? describe : describe.skip;

integration("isolated local corporate business flow", () => {
	let db: Db;
	let pipelines: PipelinesService;
	let deals: DealsService;
	let tasks: ActivitiesService;
	let dashboard: DashboardService;
	let flow: Awaited<ReturnType<PipelinesService["configure"]>>;
	let otherFlow: Awaited<ReturnType<PipelinesService["configure"]>>;
	let dealId: string;
	let taskId: string;
	let blockedCalls = 0;
	const originalFetch = globalThis.fetch;
	const definition = {
		name: "Servicios ficticios",
		isDefault: true,
		stages: [
			{ name: "Contacto", outcome: "OPEN" as const },
			{ name: "Diagnóstico", outcome: "OPEN" as const },
			{ name: "Aprobada", outcome: "WON" as const },
			{ name: "No aceptada", outcome: "LOST" as const },
		],
	};
	function stage(outcome: "OPEN" | "WON" | "LOST", position = 0) {
		const selected = flow.stages.filter((entry) => entry.outcome === outcome)[
			position
		];
		if (!selected) throw new Error("Missing synthetic flow stage.");
		return selected;
	}
	async function change(
		outcome: "OPEN" | "WON" | "LOST",
		reason?: string,
		position = 0,
	) {
		return deals.setStage(
			{
				id: dealId,
				pipelineStageId: stage(outcome, position).id,
				closedReason: reason,
			},
			"rep",
		);
	}

	beforeAll(async () => {
		const url = new URL(process.env.DATABASE_URL ?? "");
		if (
			url.protocol !== "postgresql:" ||
			url.hostname !== "127.0.0.1" ||
			!url.port ||
			url.pathname !== "/crm_business_flow_test" ||
			url.search ||
			url.hash ||
			process.env.TEST_DATABASE_URL !== url.toString() ||
			process.env.CRM_AI_ENABLED !== "false"
		) {
			throw new Error(
				"Use test:business-flow with its disposable loopback fixture.",
			);
		}
		globalThis.fetch = Object.assign(
			async () => {
				blockedCalls++;
				throw new Error(
					"External calls are forbidden in the business fixture.",
				);
			},
			{ preconnect: originalFetch.preconnect },
		);
		const database = await import("@crm/db");
		db = database.db;
		if (
			(await db.user.count()) ||
			(await db.deal.count()) ||
			(await db.company.count())
		)
			throw new Error("The business fixture must be empty.");
		for (const id of [
			"owner",
			"admin",
			"rep",
			"colleague",
			"outsider",
			"revoked",
		]) {
			await db.user.create({
				data: {
					id,
					name: `Persona ficticia ${id}`,
					email: `${id}@example.test`,
				},
			});
		}
		await db.organization.create({
			data: {
				id: "workspace",
				name: "Empresa ficticia",
				slug: "empresa-ficticia",
				createdAt: new Date(),
			},
		});
		for (const [userId, role] of [
			["owner", "owner"],
			["admin", "admin"],
			["rep", "member"],
			["colleague", "member"],
			["revoked", "member"],
		]) {
			await db.member.create({
				data: {
					id: `member-${userId}`,
					organizationId: "workspace",
					userId: userId ?? "",
					role: role ?? "",
					createdAt: new Date(),
				},
			});
		}
		await db.company.create({
			data: {
				id: "company",
				name: "Cliente ficticio",
				domain: "client.example.test",
			},
		});
		await db.company.create({
			data: {
				id: "other-company",
				name: "Otro cliente ficticio",
				domain: "other.example.test",
			},
		});
		await db.contact.create({
			data: {
				id: "contact",
				firstName: "Contacto ficticio",
				email: "contact@client.example.test",
				companyId: "company",
			},
		});
		await db.contact.create({
			data: {
				id: "other-contact",
				firstName: "Otro contacto ficticio",
				email: "contact@other.example.test",
				companyId: "other-company",
			},
		});
		const { writeReportingCurrency } = await import("@crm/db/settings");
		await writeReportingCurrency(db, "MXN");
		const { AgentTriggerService } = await import(
			"../src/agent/agent-trigger.service"
		);
		const { ActivityStampService } = await import(
			"../src/crm/activity-stamp.service"
		);
		const { ConversionService } = await import(
			"../src/currency/conversion.service"
		);
		const { FieldsService } = await import("../src/fields/fields.service");
		const { PipelinesService: Pipelines } = await import(
			"../src/pipelines/pipelines.service"
		);
		const { DealsService: Deals } = await import("../src/deals/deals.service");
		const { ActivitiesService: Tasks } = await import(
			"../src/activities/activities.service"
		);
		const { DashboardService: Dashboard } = await import(
			"../src/dashboard/dashboard.service"
		);
		const agent = new AgentTriggerService(db);
		const stamp = new ActivityStampService(db);
		const conversion = new ConversionService(db);
		pipelines = new Pipelines(db);
		deals = new Deals(
			db,
			agent,
			stamp,
			conversion,
			new FieldsService(db, agent),
			pipelines,
		);
		tasks = new Tasks(db, stamp);
		dashboard = new Dashboard(db, conversion);
	}, 30_000);

	afterAll(async () => {
		await db?.$disconnect();
		globalThis.fetch = originalFetch;
	});

	it("lists migrated stages and denies outsiders and member configuration", async () => {
		expect((await pipelines.list("rep")).canManage).toBe(false);
		expect((await pipelines.list("owner")).rows).toHaveLength(1);
		await expect(pipelines.list("outsider")).rejects.toThrow("permiso");
		await expect(pipelines.configure(definition, "rep")).rejects.toThrow(
			"permiso",
		);
	});
	it("creates an admin-configured pipeline with stable IDs and one default", async () => {
		flow = await pipelines.configure(definition, "admin");
		expect(flow.stages).toHaveLength(4);
		expect(new Set(flow.stages.map((entry) => entry.id)).size).toBe(4);
		expect(await db.pipeline.count({ where: { isDefault: true } })).toBe(1);
		expect(stage("OPEN", 0).legacyStage).toBe(stage("OPEN", 1).legacyStage);
	});
	it("rejects duplicate labels, missing outcomes and forged existing stage IDs", async () => {
		await expect(
			pipelines.configure(
				{
					...definition,
					name: "Invalid fixture",
					stages: [
						...definition.stages,
						{ name: " contacto ", outcome: "OPEN" },
					],
				},
				"owner",
			),
		).rejects.toThrow("distintos");
		await expect(
			pipelines.configure(
				{
					...definition,
					name: "Invalid fixture",
					stages: definition.stages.filter((entry) => entry.outcome !== "LOST"),
				},
				"owner",
			),
		).rejects.toThrow("LOST");
		await expect(
			pipelines.configure(
				{ ...definition, name: "Invalid fixture", stages: flow.stages },
				"owner",
			),
		).rejects.toThrow("reutiliza");
	});
	it("creates an owned opportunity in the first open stage with exact MXN money", async () => {
		const created = await deals.create(
			{
				name: "Servicio ficticio",
				companyId: "company",
				ownerId: "rep",
				currency: "MXN",
				amountCents: 1234567,
			},
			"rep",
		);
		dealId = created.id;
		const row = await deals.byId(dealId, "rep");
		expect(row.pipelineStage?.id).toBe(stage("OPEN").id);
		expect(row.amountCents).toBe(1234567);
		expect(row.baseAmountCents).toBe(1234567);
		expect(row.reportingCurrency).toBe("MXN");
		expect(
			(await deals.stageHistory(dealId, "rep"))[0]?.fromStageId,
		).toBeNull();
	});
	it("does not infer the actor from the owner and denies member assignment to another user", async () => {
		const input = {
			name: "Forbidden fixture",
			companyId: "company",
			ownerId: "colleague",
		};
		await expect(deals.create(input)).rejects.toThrow("identidad");
		await expect(deals.create(input, "rep")).rejects.toThrow("administración");
		expect(await db.deal.count()).toBe(1);
	});
	it("attaches only same-company contacts and preserves the contact role on retry", async () => {
		await deals.attachContact(
			{
				dealId,
				contactId: "contact",
				role: "Responsable ficticio",
			},
			"rep",
		);
		await deals.attachContact({ dealId, contactId: "contact" }, "rep");
		expect((await deals.byId(dealId, "rep")).contacts[0]?.role).toBe(
			"Responsable ficticio",
		);
		await expect(
			deals.attachContact({ dealId, contactId: "other-contact" }, "rep"),
		).rejects.toThrow();
		expect(await db.dealContact.count({ where: { dealId } })).toBe(1);
	});
	it("records different OPEN stage IDs despite identical legacy classifications", async () => {
		expect((await change("OPEN", "Diagnóstico ficticio", 1)).changed).toBe(
			true,
		);
		const history = await deals.stageHistory(dealId, "rep");
		expect(history).toHaveLength(2);
		expect(history[1]?.fromStageName).toBe("Contacto");
		expect(history[1]?.toStageName).toBe("Diagnóstico");
		await expect(
			deals.setStage({ id: dealId, stage: "DEMO_BOOKED" }, "rep"),
		).rejects.toThrow("identificador");
		await expect(
			deals.setStage(
				{ id: dealId, pipelineStageId: stage("WON").id },
				"colleague",
			),
		).rejects.toThrow("permiso");
	});
	it("rejects stale edits and immutable outcomes without changing stored configuration", async () => {
		await expect(
			pipelines.configure(
				{ ...flow, expectedRevision: flow.revision + 1 },
				"owner",
			),
		).rejects.toThrow("Recarga");
		await expect(
			pipelines.configure(
				{
					...flow,
					expectedRevision: flow.revision,
					stages: flow.stages.map((entry, index) =>
						index === 1 ? { ...entry, outcome: "LOST" as const } : entry,
					),
				},
				"owner",
			),
		).rejects.toThrow("inmutable");
		expect(
			(await pipelines.list("owner")).rows.find((entry) => entry.id === flow.id)
				?.revision,
		).toBe(flow.revision);
	});
	it("renames and reorders stages while preserving existing IDs and historical snapshots", async () => {
		const oldId = stage("OPEN", 1).id;
		flow = await pipelines.configure(
			{
				...flow,
				expectedRevision: flow.revision,
				stages: [...flow.stages]
					.reverse()
					.map((entry) =>
						entry.id === oldId
							? { ...entry, name: "Diagnóstico actualizado" }
							: entry,
					),
			},
			"owner",
		);
		expect((await deals.byId(dealId, "rep")).pipelineStage?.name).toBe(
			"Diagnóstico actualizado",
		);
		expect((await deals.stageHistory(dealId, "rep"))[1]?.toStageName).toBe(
			"Diagnóstico",
		);
		expect(flow.stages[0]?.outcome).toBe("LOST");
	});
	it("refuses removal of occupied stages and archival of the default", async () => {
		const current = (await deals.byId(dealId, "rep")).pipelineStage?.id;
		await expect(
			pipelines.configure(
				{
					...flow,
					expectedRevision: flow.revision,
					stages: flow.stages.filter((entry) => entry.id !== current),
				},
				"owner",
			),
		).rejects.toThrow("contiene oportunidades");
		await expect(pipelines.archive(flow.id, "owner")).rejects.toThrow(
			"predeterminado",
		);
	});
	it("requires a lost reason and rolls back the attempted transition", async () => {
		const before = await deals.byId(dealId, "rep");
		const count = await db.dealStageChange.count({ where: { dealId } });
		await expect(change("LOST")).rejects.toThrow("why");
		expect((await deals.byId(dealId, "rep")).pipelineStage?.id).toBe(
			before.pipelineStage?.id,
		);
		expect(await db.dealStageChange.count({ where: { dealId } })).toBe(count);
		await change("LOST", "No acepta el alcance ficticio");
		expect((await deals.byId(dealId, "rep")).closedReason).toBe(
			"No acepta el alcance ficticio",
		);
	});
	it("reopens without deleting the previous loss snapshot", async () => {
		await change("OPEN");
		const row = await deals.byId(dealId, "rep");
		expect(row.closedAt).toBeNull();
		expect(row.closedReason).toBeNull();
		expect(
			(await deals.stageHistory(dealId, "rep")).some(
				(entry) =>
					entry.toOutcome === "LOST" &&
					entry.reason === "No acepta el alcance ficticio",
			),
		).toBe(true);
	});
	it("creates one accountable handoff task on win and no duplicate on retry", async () => {
		await change("WON", "Aceptación ficticia");
		expect((await change("WON")).changed).toBe(false);
		const handoffs = await db.activity.findMany({
			where: { dealId, type: "TASK" },
		});
		expect(handoffs).toHaveLength(1);
		expect(handoffs[0]?.createdById).toBe("rep");
		expect(handoffs[0]?.assigneeId).toBe("rep");
		expect(handoffs[0]?.priority).toBe(2);
	});
	it("assigns a dated task to another person without changing its author", async () => {
		const task = await tasks.create(
			{
				type: "TASK",
				subject: "Revisión ficticia",
				dealId,
				contactId: "contact",
				assigneeId: "colleague",
				priority: 3,
				dueAt: "2026-01-01T10:00:00.000Z",
			},
			"owner",
		);
		taskId = task.id;
		expect(task.createdBy.id).toBe("owner");
		expect(task.assignee?.id).toBe("colleague");
		expect(
			(await tasks.myTasks({ window: "overdue", limit: 25 }, "colleague")).some(
				(entry) => entry.id === taskId,
			),
		).toBe(true);
		expect(
			(await tasks.myTasks({ window: "all", limit: 25 }, "owner")).some(
				(entry) => entry.id === taskId,
			),
		).toBe(false);
	});
	it("allows completion and rescheduling by the assignee and denies unrelated members", async () => {
		await expect(tasks.complete(taskId, true, "rep")).rejects.toThrow(
			"task author",
		);
		await tasks.updateTask(
			{ id: taskId, dueAt: "2027-04-02T08:00:00-06:00", priority: 1 },
			"colleague",
		);
		const complete = await tasks.complete(taskId, true, "colleague");
		expect(complete.completedAt).not.toBeNull();
		expect(complete.dueAt).toBe("2027-04-02T14:00:00.000Z");
		expect((await tasks.complete(taskId, false, "owner")).createdBy.id).toBe(
			"owner",
		);
	});
	it("permits elevated reassignment and immediately denies a revoked member", async () => {
		await expect(
			tasks.updateTask({ id: taskId, assigneeId: "rep" }, "colleague"),
		).rejects.toThrow("owner or admin");
		expect(
			(await tasks.updateTask({ id: taskId, assigneeId: "rep" }, "admin"))
				.createdBy.id,
		).toBe("owner");
		await db.member.delete({ where: { id: "member-revoked" } });
		await expect(
			tasks.myTasks({ window: "all", limit: 25 }, "revoked"),
		).rejects.toThrow("membership");
		await expect(pipelines.list("revoked")).rejects.toThrow("permiso");
	});
	it("keeps archived deals out of totals and task queues, and restores them", async () => {
		const initial = await dashboard.summary("rep", { scope: "me" });
		await deals.archive(dealId, "rep");
		const archived = await dashboard.summary("rep", { scope: "me" });
		expect(archived.wonThisMonth.count).toBe(initial.wonThisMonth.count - 1);
		expect(
			(await tasks.myTasks({ window: "all", limit: 25 }, "rep")).some(
				(entry) => entry.deal?.id === dealId,
			),
		).toBe(false);
		await expect(change("OPEN")).rejects.toThrow("Restaura");
		await deals.restore(dealId, "rep");
		expect(
			(await dashboard.summary("rep", { scope: "me" })).wonThisMonth.count,
		).toBe(initial.wonThisMonth.count);
	});
	it("requires explicit cross-pipeline transfer and archives only an empty nondefault pipeline", async () => {
		otherFlow = await pipelines.configure(
			{ ...definition, name: "Otro proceso ficticio", isDefault: false },
			"owner",
		);
		const target = otherFlow.stages[0];
		if (!target) throw new Error("Missing alternate fixture stage.");
		await expect(
			deals.setStage({ id: dealId, pipelineStageId: target.id }, "rep"),
		).rejects.toThrow("pipeline indicado");
		await deals.setStage(
			{ id: dealId, pipelineId: otherFlow.id, pipelineStageId: target.id },
			"rep",
		);
		expect((await deals.byId(dealId, "rep")).pipelineStage?.pipelineId).toBe(
			otherFlow.id,
		);
		await expect(pipelines.archive(otherFlow.id, "owner")).rejects.toThrow(
			"contiene oportunidades",
		);
		await deals.setStage(
			{ id: dealId, pipelineId: flow.id, pipelineStageId: stage("OPEN").id },
			"rep",
		);
		await pipelines.archive(otherFlow.id, "owner");
		expect(
			(await pipelines.list("owner")).rows.some(
				(entry) => entry.id === otherFlow.id,
			),
		).toBe(false);
	});
	it("filters configurable stage IDs and reconciles matching facet counts", async () => {
		const { dealListInput } = await import("../src/deals/deals.contracts");
		const input = dealListInput.parse({
			pipelineStageIds: [stage("OPEN").id],
			sort: "stage",
			pageSize: 100,
		});
		const matching = await deals.list(input, "rep");
		expect(matching.rows.map((row) => row.id)).toEqual([dealId]);
		expect(matching.facetCounts.pipelineStageIds?.[stage("OPEN").id]).toBe(1);
		expect(
			(
				await deals.list(
					{ ...input, pipelineStageIds: [stage("LOST").id] },
					"rep",
				)
			).total,
		).toBe(0);
	});
	it("moves bulk stages by ID and records partial permission failures", async () => {
		const extra = await deals.create(
			{
				name: "Otra oportunidad ficticia",
				companyId: "company",
				ownerId: "colleague",
				pipelineId: flow.id,
			},
			"owner",
		);
		const moved = await deals.bulkSetStage(
			{ ids: [dealId, extra.id], pipelineStageId: stage("OPEN", 1).id },
			"rep",
		);
		expect(moved).toMatchObject({ requested: 2, succeeded: 1, failed: 1 });
		expect((await deals.byId(dealId, "rep")).pipelineStage?.id).toBe(
			stage("OPEN", 1).id,
		);
		expect((await deals.byId(extra.id, "rep")).pipelineStage?.id).toBe(
			stage("OPEN").id,
		);
		expect((await deals.stageHistory(dealId, "rep"))[0]?.toStageId).toBe(
			stage("OPEN", 1).id,
		);
	});
	it("rolls back bulk losses without reasons and retries wins without duplicate handoffs", async () => {
		const before = await db.dealStageChange.count({ where: { dealId } });
		const rejected = await deals.bulkSetStage(
			{ ids: [dealId], pipelineStageId: stage("LOST").id },
			"rep",
		);
		expect(rejected).toMatchObject({ succeeded: 0, failed: 1 });
		expect(await db.dealStageChange.count({ where: { dealId } })).toBe(before);
		await deals.bulkSetStage(
			{ ids: [dealId], pipelineStageId: stage("WON").id },
			"rep",
		);
		const count = await db.activity.count({
			where: { dealId, type: "TASK", id: { startsWith: "handoff-" } },
		});
		await deals.bulkSetStage(
			{ ids: [dealId], pipelineStageId: stage("WON").id },
			"rep",
		);
		expect(
			await db.activity.count({
				where: { dealId, type: "TASK", id: { startsWith: "handoff-" } },
			}),
		).toBe(count);
	});
	it("does not queue AI, mutate another instance or call an external provider", async () => {
		expect(await db.agentTask.count()).toBe(0);
		expect(await db.organization.count()).toBe(1);
		expect(blockedCalls).toBe(0);
	});
	registerOpportunityAuthorizationTests(() => ({ db, deals, flow, dealId }));
});

function registerOpportunityAuthorizationTests(
	fixture: () => {
		db: Db;
		deals: DealsService;
		flow: Awaited<ReturnType<PipelinesService["configure"]>>;
		dealId: string;
	},
) {
	it("denies missing, removed and unrelated identities on inherited opportunity writers", async () => {
		const { db, deals, dealId } = fixture();
		const before = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
		for (const actor of [undefined, "outsider", "revoked", "colleague"]) {
			await expect(
				deals.update(dealId, { name: "Cambio rechazado" }, actor),
			).rejects.toThrow();
			await expect(deals.archive(dealId, actor)).rejects.toThrow();
			await expect(deals.restore(dealId, actor)).rejects.toThrow();
		}
		expect(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).toEqual(
			before,
		);
	});
	it("allows owned edits without allowing self-promotion through owner changes", async () => {
		const { db, deals, dealId } = fixture();
		await deals.update(
			dealId,
			{ description: "Detalle ficticio autorizado" },
			"rep",
		);
		await expect(
			deals.update(dealId, { ownerId: "colleague" }, "rep"),
		).rejects.toThrow();
		expect(
			(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).ownerId,
		).toBe("rep");
		await deals.update(dealId, { ownerId: "colleague" }, "admin");
		await expect(
			deals.update(dealId, { name: "Ya no me pertenece" }, "rep"),
		).rejects.toThrow();
		await deals.update(dealId, { ownerId: "rep" }, "owner");
	});
	it("rejects reassignment to an account that has no active workspace membership", async () => {
		const { db, deals, dealId } = fixture();
		await expect(
			deals.update(dealId, { ownerId: "outsider" }, "owner"),
		).rejects.toThrow();
		await expect(
			deals.bulkAssignOwner({ ids: [dealId], ownerId: "outsider" }, "owner"),
		).rejects.toThrow();
		await expect(
			deals.bulkAssignOwner({ ids: [dealId], ownerId: "colleague" }, "rep"),
		).rejects.toThrow();
		expect(
			(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).ownerId,
		).toBe("rep");
	});
	it("archives and restores owned records without changing commercial fields", async () => {
		const { db, deals, dealId } = fixture();
		const before = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
		await deals.archive(dealId, "rep");
		await expect(
			deals.update(dealId, { description: "Cambio sobre archivo" }, "owner"),
		).rejects.toThrow();
		await expect(deals.restore(dealId, "colleague")).rejects.toThrow();
		await deals.restore(dealId, "rep");
		const after = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
		expect({ ...after, updatedAt: before.updatedAt }).toEqual(before);
	});
	it("denies contact link mutations by other representatives without changing the link", async () => {
		const { db, deals, dealId } = fixture();
		await deals.attachContact(
			{ dealId, contactId: "contact", role: "Contacto ficticio" },
			"rep",
		);
		const link = await db.dealContact.findUniqueOrThrow({
			where: { dealId_contactId: { dealId, contactId: "contact" } },
		});
		await expect(
			deals.detachContact({ dealId, contactId: "contact" }, "colleague"),
		).rejects.toThrow();
		await expect(
			deals.setContactRole(
				{ dealId, contactId: "contact", role: "Rechazado" },
				"colleague",
			),
		).rejects.toThrow();
		expect(
			await db.dealContact.findUniqueOrThrow({
				where: { dealId_contactId: { dealId, contactId: "contact" } },
			}),
		).toEqual(link);
		await deals.setContactRole(
			{ dealId, contactId: "contact", role: "Responsable ficticio" },
			"admin",
		);
	});
	it("rejects archived contacts, archived companies and transfers that invalidate existing links", async () => {
		const { db, deals, dealId } = fixture();
		await db.contact.update({
			where: { id: "contact" },
			data: { archivedAt: new Date() },
		});
		await expect(
			deals.attachContact({ dealId, contactId: "contact" }, "rep"),
		).rejects.toThrow();
		await db.contact.update({
			where: { id: "contact" },
			data: { archivedAt: null },
		});
		await expect(
			deals.update(dealId, { companyId: "other-company" }, "owner"),
		).rejects.toThrow();
		await deals.detachContact({ dealId, contactId: "contact" }, "rep");
		await db.company.update({
			where: { id: "other-company" },
			data: { archivedAt: new Date() },
		});
		await expect(
			deals.update(dealId, { companyId: "other-company" }, "owner"),
		).rejects.toThrow();
		await db.company.update({
			where: { id: "other-company" },
			data: { archivedAt: null },
		});
	});
	it("handles mixed-owner bulk archives and ownership assignment with per-record checks", async () => {
		const { db, deals, flow, dealId } = fixture();
		const extra = await deals.create(
			{
				name: "Archivo ficticio separado",
				companyId: "company",
				ownerId: "colleague",
				pipelineId: flow.id,
			},
			"owner",
		);
		const result = await deals.bulkArchive([dealId, extra.id], "rep");
		expect(result).toMatchObject({ requested: 2, succeeded: 1, failed: 1 });
		expect(
			(await db.deal.findUniqueOrThrow({ where: { id: extra.id } })).archivedAt,
		).toBeNull();
		await deals.bulkRestore([dealId, extra.id], "admin");
		const assigned = await deals.bulkAssignOwner(
			{ ids: [extra.id, "missing-deal"], ownerId: "rep" },
			"admin",
		);
		expect(assigned).toMatchObject({ requested: 2, succeeded: 1, failed: 1 });
	});
	it("allows only an owner to purge an archived opportunity and preserves active records", async () => {
		const { db, deals, flow } = fixture();
		const doomed = await deals.create(
			{
				name: "Eliminación ficticia",
				companyId: "company",
				ownerId: "rep",
				pipelineId: flow.id,
			},
			"owner",
		);
		await expect(deals.purge(doomed.id, "owner")).rejects.toThrow();
		await deals.archive(doomed.id, "rep");
		for (const actor of [
			undefined,
			"admin",
			"rep",
			"colleague",
			"outsider",
			"revoked",
		]) {
			await expect(deals.purge(doomed.id, actor)).rejects.toThrow();
		}
		expect(await db.deal.count({ where: { id: doomed.id } })).toBe(1);
		await deals.purge(doomed.id, "owner");
		expect(await db.deal.count({ where: { id: doomed.id } })).toBe(0);
	});
	it("requires active membership for reads and bulk operations, including empty selections", async () => {
		const { db, deals, dealId } = fixture();
		const { dealListInput } = await import("../src/deals/deals.contracts");
		for (const actor of [undefined, "outsider", "revoked"]) {
			await expect(deals.byId(dealId, actor)).rejects.toThrow();
			await expect(
				deals.list(dealListInput.parse({}), actor),
			).rejects.toThrow();
			await expect(deals.contactOptions(dealId, actor)).rejects.toThrow();
			await expect(deals.bulkArchive([], actor)).rejects.toThrow();
			await expect(deals.bulkRestore([], actor)).rejects.toThrow();
			await expect(deals.bulkPurge([], actor)).rejects.toThrow();
		}
		await db.member.update({
			where: { id: "member-colleague" },
			data: { role: "viewer" },
		});
		try {
			await expect(deals.byId(dealId, "colleague")).rejects.toThrow();
		} finally {
			await db.member.update({
				where: { id: "member-colleague" },
				data: { role: "member" },
			});
		}
		expect((await deals.byId(dealId, "colleague")).id).toBe(dealId);
	});
	it("rejects archived links and keeps a repeated archive's retention timestamp", async () => {
		const { db, deals, dealId } = fixture();
		await deals.archive(dealId, "rep");
		const before = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
		await deals.archive(dealId, "admin");
		expect(
			(await db.deal.findUniqueOrThrow({ where: { id: dealId } })).archivedAt,
		).toEqual(before.archivedAt);
		await expect(
			deals.attachContact({ dealId, contactId: "contact" }, "owner"),
		).rejects.toThrow();
		await expect(
			deals.detachContact({ dealId, contactId: "contact" }, "owner"),
		).rejects.toThrow();
		await expect(
			deals.setContactRole(
				{ dealId, contactId: "contact", role: "Rechazado" },
				"owner",
			),
		).rejects.toThrow();
		await deals.restore(dealId, "rep");
	});
	it("rejects stale money preparation without overwriting the newer persisted amount", async () => {
		const { db, deals, dealId } = fixture();
		const conversion = Reflect.get(deals, "conversion") as ConversionService;
		const original = conversion.dealFields;
		conversion.dealFields = async function (amount, currency) {
			const result = await original.call(this, amount, currency);
			await db.deal.update({
				where: { id: dealId },
				data: { amount: "200.00" },
			});
			return result;
		};
		try {
			await expect(
				deals.update(dealId, { currency: "USD" }, "rep"),
			).rejects.toThrow("importe cambió");
			expect(
				(
					await db.deal.findUniqueOrThrow({ where: { id: dealId } })
				).amount?.toString(),
			).toBe("200");
		} finally {
			conversion.dealFields = original;
		}
		await deals.update(
			dealId,
			{ amountCents: 1234567, currency: "MXN" },
			"rep",
		);
		expect((await deals.byId(dealId, "rep")).baseAmountCents).toBe(1234567);
	});
	it("rechecks the actor's role after money preparation and writes nothing after revocation", async () => {
		const { db, deals, dealId } = fixture();
		const before = await db.deal.findUniqueOrThrow({ where: { id: dealId } });
		const conversion = Reflect.get(deals, "conversion") as ConversionService;
		const original = conversion.dealFields;
		conversion.dealFields = async function (amount, currency) {
			const result = await original.call(this, amount, currency);
			await db.member.update({
				where: { id: "member-rep" },
				data: { role: "viewer" },
			});
			return result;
		};
		try {
			await expect(
				deals.update(dealId, { amountCents: 20000 }, "rep"),
			).rejects.toThrow("permiso");
			expect(
				await db.deal.findUniqueOrThrow({ where: { id: dealId } }),
			).toEqual(before);
		} finally {
			conversion.dealFields = original;
			await db.member.update({
				where: { id: "member-rep" },
				data: { role: "member" },
			});
		}
	});
	it("keeps trusted retention separate and removes only expired archived fixture opportunities", async () => {
		const { db, deals, flow } = fixture();
		const expired = await deals.create(
			{
				name: "Retención ficticia vencida",
				companyId: "company",
				ownerId: "rep",
				pipelineId: flow.id,
			},
			"rep",
		);
		const recent = await deals.create(
			{
				name: "Archivo ficticio vigente",
				companyId: "company",
				ownerId: "rep",
				pipelineId: flow.id,
			},
			"rep",
		);
		const active = await deals.create(
			{
				name: "Registro ficticio activo",
				companyId: "company",
				ownerId: "rep",
				pipelineId: flow.id,
			},
			"rep",
		);
		await deals.archive(expired.id, "rep");
		await deals.archive(recent.id, "rep");
		await db.deal.update({
			where: { id: expired.id },
			data: { archivedAt: new Date("2020-01-01T00:00:00Z") },
		});
		expect(
			await deals.purgeExpired(new Date("2020-01-02T00:00:00Z")),
		).toMatchObject({ requested: 1, succeeded: 1, failed: 0 });
		expect(await db.deal.count({ where: { id: expired.id } })).toBe(0);
		expect(
			await db.deal.count({ where: { id: { in: [recent.id, active.id] } } }),
		).toBe(2);
		await deals.purge(recent.id, "owner");
		await deals.archive(active.id, "rep");
		await deals.purge(active.id, "owner");
	});
}
