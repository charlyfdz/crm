import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import type { Db, Prisma } from "@crm/db";
import type { Cache } from "cache-manager";
import type { AgentAccessService } from "../src/agent/agent-access.service";
import type { BackfillService } from "../src/backfill/backfill.service";

const savedEnvironment = {
	NODE_ENV: process.env.NODE_ENV,
	TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
	ALLOWED_SIGN_IN: process.env.ALLOWED_SIGN_IN,
	CRM_AI_ENABLED: process.env.CRM_AI_ENABLED,
	AGENT_BRIDGE_SECRET: process.env.AGENT_BRIDGE_SECRET,
	AGENT_URL: process.env.AGENT_URL,
};

Object.assign(process.env, { NODE_ENV: "test" });
process.env.TEST_DATABASE_URL ??=
	"postgresql://unused:unused@127.0.0.1:65534/crm_ai_policy_test";
process.env.BETTER_AUTH_SECRET ??=
	"ai-policy-test-secret-not-a-real-credential";
process.env.ALLOWED_SIGN_IN ??= "example.test";
process.env.AGENT_BRIDGE_SECRET = "ai-policy-test-bridge";
process.env.AGENT_URL = "http://127.0.0.1:65534";

const { AgentTriggerService } = await import(
	"../src/agent/agent-trigger.service"
);
const { AgentQueueService } = await import("../src/agent/agent-queue.service");
const { DispatchHeartbeatService } = await import(
	"../src/agent/dispatch-heartbeat.service"
);
const { ResearchKeyService } = await import(
	"../src/agent/research-key.service"
);
const { AgentRunsService } = await import("../src/agent/agent-runs.service");
const { AgentDefinitionsService } = await import(
	"../src/agent/agent-definitions.service"
);
const { ConversationsService } = await import(
	"../src/conversations/conversations.service"
);
const { ModelCatalogService } = await import(
	"../src/settings/model-catalog.service"
);
const { SettingsService } = await import("../src/settings/settings.service");
const { researchKeyOutput } = await import(
	"../src/settings/settings.contracts"
);
const { AiPolicyDisabledException, requireApiAiEnabled } = await import(
	"../src/agent/ai-policy"
);
const { aiFeaturePolicy } = await import("@crm/env/features");
const { DomainErrorMiddleware } = await import(
	"../src/trpc/middlewares/domain-error.middleware"
);
const { TRPCError } = await import("@trpc/server");
type TriggerService = InstanceType<typeof AgentTriggerService>;
type CatalogService = InstanceType<typeof ModelCatalogService>;
type KeyService = InstanceType<typeof ResearchKeyService>;
type ErrorMiddleware = InstanceType<typeof DomainErrorMiddleware>;
const network = spyOn(globalThis, "fetch").mockRejectedValue(
	new Error("Network is forbidden in AI policy tests."),
);

function queueDatabase() {
	const tasks = {
		findFirst: mock(async () => null),
		findMany: mock(async () => []),
		create: mock(async (_input: Prisma.AgentTaskCreateArgs) => ({
			id: "task-test",
		})),
		createMany: mock(async () => ({ count: 1 })),
		update: mock(async () => ({ id: "existing-task" })),
	};
	const tx = {
		agentTask: tasks,
		$queryRaw: mock(async () => [{ locked: true }]),
	};
	const transaction = mock(
		async (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
			work(tx as unknown as Prisma.TransactionClient),
	);
	return {
		tasks,
		tx,
		transaction,
		db: { agentTask: tasks, $transaction: transaction } as unknown as Db,
	};
}

beforeEach(() => {
	delete process.env.CRM_AI_ENABLED;
	network.mockClear();
	network.mockRejectedValue(
		new Error("Network is forbidden in AI policy tests."),
	);
});

afterAll(async () => {
	network.mockRestore();
	const { db } = await import("@crm/db");
	await db.$disconnect();
	for (const [key, value] of Object.entries(savedEnvironment)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("installation AI queue policy", () => {
	it("creates no automatic tasks without explicit opt-in", async () => {
		const database = queueDatabase();
		const service = new AgentTriggerService(database.db);
		await service.companyCreated("company-test");
		expect(database.transaction).not.toHaveBeenCalled();
		expect(database.tasks.create).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});

	it("commits manual work with inert CRM event callbacks", async () => {
		const database = queueDatabase();
		const service = new AgentTriggerService(database.db);
		const manualWrite = mock(async () => ({ id: "manual-deal" }));
		const result = await service.withCrmEvents(async (tx, emit) => {
			expect(Object.is(tx, database.tx)).toBe(true);
			const record = await manualWrite();
			await emit({
				type: "deal.created",
				record: { kind: "deal", id: record.id },
				occurredAt: new Date("2026-10-02T12:00:00Z"),
				data: {},
			});
			return record;
		});
		expect(result).toEqual({ id: "manual-deal" });
		expect(manualWrite).toHaveBeenCalledTimes(1);
		expect(database.transaction).toHaveBeenCalledTimes(1);
		expect(database.tasks.create).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});

	for (const value of [
		undefined,
		"",
		"false",
		"1",
		"TRUE",
		"True",
		" true",
		"true ",
	]) {
		it(`refuses opt-in value ${JSON.stringify(value)}`, async () => {
			if (value !== undefined) process.env.CRM_AI_ENABLED = value;
			const database = queueDatabase();
			const service = new AgentTriggerService(database.db);
			await service.companyCreated("company-test");
			await service.contactCreated("contact-test", "manual contact");
			await service.workspaceChanged("example.test", "manual workspace");
			await service.meetingSoon("contact-test", new Date());
			await service.slackPeopleRequested("automatic match");
			expect(
				await service.fieldBackfillRecords(
					"COMPANY",
					["industry"],
					["company-test"],
					"automatic field",
				),
			).toEqual({ queued: 0, merged: 0 });
			expect(
				await service.backfill({
					kind: "brand",
					reason: "sweep",
					companyIds: ["company-test"],
				}),
			).toEqual({ queued: 0, alreadyQueued: 0 });
			expect(service.canReachAgent()).toBe(false);
			service.drainQueues();
			service.builderConversationQueued();
			service.deployedAgentRunQueued();
			await service.redeliverCancellations();
			expect(database.transaction).not.toHaveBeenCalled();
			expect(database.tasks.findMany).not.toHaveBeenCalled();
			expect(database.tasks.createMany).not.toHaveBeenCalled();
			expect(database.tasks.update).not.toHaveBeenCalled();
			expect(network).not.toHaveBeenCalled();
		});
	}

	it("preserves manual transactions with inert task callbacks", async () => {
		const database = queueDatabase();
		const service = new AgentTriggerService(database.db);
		const result = await service.withTasks(async (tx, queue) => {
			expect(Object.is(tx, database.tx)).toBe(true);
			await queue.slackChannelJoinRequested("channel-test", "test-channel");
			return "manual-result";
		});
		expect(result).toBe("manual-result");
		expect(database.transaction).toHaveBeenCalledTimes(1);
		expect(database.tasks.create).not.toHaveBeenCalled();
		expect(database.tx.$queryRaw).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});

	it("propagates manual transaction failures without queue writes", async () => {
		const database = queueDatabase();
		const service = new AgentTriggerService(database.db);
		await expect(
			service.withCrmEvents(async () => {
				throw new Error("manual failure");
			}),
		).rejects.toThrow("manual failure");
		expect(database.tasks.create).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});

	it("queues tasks only after literal opt-in, with mocked dispatch", async () => {
		process.env.CRM_AI_ENABLED = "true";
		network.mockResolvedValue(new Response(null, { status: 200 }));
		const database = queueDatabase();
		const service = new AgentTriggerService(database.db);
		await service.companyCreated("company-test");
		expect(database.tasks.create).toHaveBeenCalledTimes(2);
		expect(database.tasks.create.mock.calls[0]?.length).toBe(1);
		expect(network).toHaveBeenCalledTimes(2);
		delete process.env.CRM_AI_ENABLED;
		await service.companyCreated("second-company");
		expect(database.tasks.create).toHaveBeenCalledTimes(2);
		expect(network).toHaveBeenCalledTimes(2);
	});

	it("does not mark stored pending tasks as active while disabled", async () => {
		const database = queueDatabase();
		const queue = new AgentQueueService(database.db);
		expect(await queue.queuedCompanies(["company-test"])).toEqual(new Set());
		expect(await queue.queuedContacts(["contact-test"])).toEqual(new Set());
		expect(await queue.isQueued({ companyId: "company-test" })).toBe(false);
		expect(database.tasks.findMany).not.toHaveBeenCalled();
		expect(database.tasks.findFirst).not.toHaveBeenCalled();
		expect(database.tasks.update).not.toHaveBeenCalled();
	});

	it("does not start the heartbeat even with a configured bridge", () => {
		const trigger = {
			canReachAgent: mock(() => true),
			drainQueues: mock(() => undefined),
		};
		const heartbeat = new DispatchHeartbeatService(
			trigger as unknown as TriggerService,
		);
		heartbeat.onApplicationBootstrap();
		heartbeat.onApplicationShutdown();
		expect(trigger.canReachAgent).not.toHaveBeenCalled();
		expect(trigger.drainQueues).not.toHaveBeenCalled();
	});
});

describe("explicit AI requests", () => {
	it("returns a typed policy exception instead of a provider failure", () => {
		expect(requireApiAiEnabled).toThrow(AiPolicyDisabledException);
		const policy = aiFeaturePolicy();
		if (policy.enabled) throw new Error("Test policy must be disabled.");
		const error = new AiPolicyDisabledException(policy);
		expect(error.code).toBe("CRM_AI_DISABLED");
		expect(error.getStatus()).toBe(403);
		expect(error.message).toStartWith("CRM_AI_DISABLED:");
		expect(error.getResponse()).toEqual({
			message: error.message,
			code: error.code,
			feature: policy,
		});
	});

	it("maps the policy exception through the existing tRPC middleware", async () => {
		const policy = aiFeaturePolicy();
		if (policy.enabled) throw new Error("Test policy must be disabled.");
		const failure = new AiPolicyDisabledException(policy);
		const options = {
			next: async () => ({
				ok: false,
				error: new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: failure }),
			}),
		} as unknown as Parameters<ErrorMiddleware["use"]>[0];
		const error = await new DomainErrorMiddleware()
			.use(options)
			.catch((cause: unknown) => cause);
		expect(error).toBeInstanceOf(TRPCError);
		if (!(error instanceof TRPCError))
			throw new Error("Missing tRPC policy error.");
		expect(error.code).toBe("FORBIDDEN");
		expect(error.message).toStartWith("CRM_AI_DISABLED:");
	});

	for (const operation of ["company", "contact", "slack"] as const) {
		it(`rejects explicit ${operation} enqueue before any database work`, async () => {
			const database = queueDatabase();
			const service = new AgentTriggerService(database.db);
			const request =
				operation === "company"
					? service.companyRequested("company-test", "manual research")
					: operation === "contact"
						? service.contactCreated("contact-test", "manual research", true)
						: service.slackChannelJoinRequested("channel-test", "test-channel");
			await expect(request).rejects.toThrow(AiPolicyDisabledException);
			expect(database.transaction).not.toHaveBeenCalled();
			expect(network).not.toHaveBeenCalled();
		});
	}

	for (const operation of [
		"run",
		"retry",
		"deploy",
		"resume",
		"builder",
		"submit",
		"answer",
	] as const) {
		it(`rejects ${operation} before submissions, attachments, or database writes`, async () => {
			const db = {} as Db;
			const access = {} as AgentAccessService;
			const trigger = new AgentTriggerService(db);
			const runs = new AgentRunsService(db, access, trigger);
			const agents = new AgentDefinitionsService(db, access, trigger);
			const conversations = new ConversationsService(db, trigger);
			const input = { id: "agent-test", clientRequestId: "request-test" };
			const operations = {
				run: () => runs.runNow(input, "user-test"),
				retry: () =>
					runs.retryRun({ ...input, runId: "run-test" }, "user-test"),
				deploy: () =>
					agents.deploy({ ...input, versionId: "version-test" }, "user-test"),
				resume: () => agents.resume(input.id, "user-test"),
				builder: () =>
					conversations.createBuilder(
						{
							clientRequestId: "request-test",
							commandType: "CHAT",
							message: "test",
							resources: [],
							attachments: [],
						},
						"user-test",
					),
				submit: () =>
					conversations.submitBuilder(
						{
							...input,
							commandType: "CHAT",
							message: "test",
							resources: [],
							attachments: [],
						},
						"user-test",
					),
				answer: () =>
					conversations.answerBuilderQuestion(
						{
							...input,
							requestId: "question-test",
							text: "test",
						},
						"user-test",
					),
			};
			await expect(operations[operation]()).rejects.toThrow(
				AiPolicyDisabledException,
			);
			expect(network).not.toHaveBeenCalled();
		});
	}
});

describe("research keys and model catalog", () => {
	it("verifies no candidate key while disabled, despite bridge configuration", async () => {
		const result = await new ResearchKeyService().verify("synthetic-key-only");
		expect(result).toMatchObject({
			outcome: "disabled",
			code: "CRM_AI_DISABLED",
		});
		expect(network).not.toHaveBeenCalled();
	});

	it("blocks research-key saving and model selection before dependencies run", async () => {
		const db = {} as Db;
		const catalog = {} as CatalogService;
		const researchKeys = {} as KeyService;
		const backfill = {} as BackfillService;
		const settings = new SettingsService(db, catalog, researchKeys, backfill);
		await expect(settings.setResearchKey("synthetic-key-only")).rejects.toThrow(
			AiPolicyDisabledException,
		);
		await expect(settings.setAgentModel("synthetic/model")).rejects.toThrow(
			AiPolicyDisabledException,
		);
		await expect(settings.setAgentModel(null)).rejects.toThrow(
			AiPolicyDisabledException,
		);
		expect(network).not.toHaveBeenCalled();
	});

	it("separates a configured key from installation permission without exposing the key", async () => {
		const db = {
			appSetting: {
				findUnique: mock(async () => ({
					contextDevApiKey: "synthetic-key-1234",
				})),
			},
		} as unknown as Db;
		const settings = new SettingsService(
			db,
			{} as CatalogService,
			{} as KeyService,
			{} as BackfillService,
		);
		const result = researchKeyOutput.parse(await settings.researchKey());
		expect(result.configured).toBe(true);
		expect(result.hint).toBe("••••1234");
		expect(result.ai).toMatchObject({
			enabled: false,
			code: "CRM_AI_DISABLED",
		});
		expect(JSON.stringify(result)).not.toContain("synthetic-key");
		expect(network).not.toHaveBeenCalled();
	});

	it("uses neither the model-catalog cache nor the network while disabled", async () => {
		const cache = {
			get: mock(async () => []),
			set: mock(async () => undefined),
		};
		const catalog = new ModelCatalogService(cache as unknown as Cache);
		expect(await catalog.models()).toBeNull();
		expect(await catalog.find("synthetic/model")).toBeNull();
		expect(cache.get).not.toHaveBeenCalled();
		expect(cache.set).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});

	it("preserves key verification after explicit opt-in with a mock agent", async () => {
		process.env.CRM_AI_ENABLED = "true";
		network.mockResolvedValue(Response.json({ outcome: "valid" }));
		expect(await new ResearchKeyService().verify("synthetic-key-only")).toEqual(
			{ outcome: "valid" },
		);
		expect(network).toHaveBeenCalledTimes(1);
	});

	it("keeps manual archive-retention settings available", async () => {
		const update = mock(async () => ({}));
		const db = {
			appSetting: {
				upsert: update,
				findUnique: mock(async () => ({ archiveRetentionDays: 45 })),
			},
		} as unknown as Db;
		const settings = new SettingsService(
			db,
			{} as CatalogService,
			{} as KeyService,
			{} as BackfillService,
		);
		expect(await settings.setArchiveRetention(45)).toEqual({ days: 45 });
		expect(await settings.archiveRetention()).toEqual({ days: 45 });
		expect(update).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});

	it("saves a research key and starts backfill only after explicit opt-in", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const savedKey = "synthetic-new-key-9876";
		const upsert = mock(async () => ({}));
		const db = {
			appSetting: {
				upsert,
				findUnique: mock(async () => ({ contextDevApiKey: savedKey })),
			},
		} as unknown as Db;
		const researchKeys = {
			verify: mock(async () => ({ outcome: "valid" as const })),
		};
		const backfill = { run: mock(async () => ({ queued: 1, remaining: 0 })) };
		const settings = new SettingsService(
			db,
			{} as CatalogService,
			researchKeys as unknown as KeyService,
			backfill as unknown as BackfillService,
		);
		const result = researchKeyOutput.parse(
			await settings.setResearchKey(savedKey),
		);
		expect(result).toEqual({
			configured: true,
			hint: "••••9876",
			ai: { enabled: true, status: "enabled" },
		});
		expect(upsert).toHaveBeenCalledTimes(1);
		expect(backfill.run).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});

	it("does not save a key when opt-in changes during verification", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const upsert = mock(async () => ({}));
		const db = { appSetting: { upsert } } as unknown as Db;
		const researchKeys = {
			verify: mock(async () => {
				delete process.env.CRM_AI_ENABLED;
				return { outcome: "unknown" as const, reason: "mock verification" };
			}),
		};
		const backfill = { run: mock(async () => ({ queued: 0, remaining: 0 })) };
		const settings = new SettingsService(
			db,
			{} as CatalogService,
			researchKeys as unknown as KeyService,
			backfill as unknown as BackfillService,
		);
		await expect(settings.setResearchKey("synthetic-key-only")).rejects.toThrow(
			AiPolicyDisabledException,
		);
		expect(upsert).not.toHaveBeenCalled();
		expect(backfill.run).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});
});

describe("manual history and cancellation without AI", () => {
	it("reads stored transcripts and removes a conversation without dispatch", async () => {
		const tx = {
			agentBuilderArtifact: { deleteMany: mock(async () => ({ count: 0 })) },
			agentEvent: { deleteMany: mock(async () => ({ count: 1 })) },
			agentConversation: {
				delete: mock(async () => ({ id: "conversation-test" })),
			},
		};
		const db = {
			member: { findUnique: mock(async () => ({ id: "member-test" })) },
			agentConversation: {
				findUnique: mock(async () => ({
					id: "conversation-test",
					kind: "BUILDER",
					userId: "user-test",
					sessionId: "session-test",
				})),
			},
			agentEvent: {
				findMany: mock(async () => [
					{
						id: "event-test",
						type: "message",
						data: { text: "stored response" },
						emittedAt: new Date("2026-10-02T12:00:00Z"),
					},
				]),
			},
			$transaction: async (
				work: (client: Prisma.TransactionClient) => Promise<unknown>,
			) => work(tx as unknown as Prisma.TransactionClient),
		} as unknown as Db;
		const service = new ConversationsService(db, new AgentTriggerService(db));
		expect(
			await service.events({ id: "conversation-test", limit: 10 }, "user-test"),
		).toEqual([
			{
				type: "message",
				data: { text: "stored response" },
				meta: { id: "event-test", at: "2026-10-02T12:00:00.000Z" },
			},
		]);
		expect(await service.remove("conversation-test", "user-test")).toEqual({
			id: "conversation-test",
		});
		expect(tx.agentConversation.delete).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});

	it("does not report a pending builder submission as working while disabled", async () => {
		const db = {
			member: { findUnique: mock(async () => ({ id: "member-test" })) },
			agentConversation: {
				findMany: mock(async () => [
					{
						id: "conversation-test",
						sessionId: "session-test",
						continuationToken: null,
						streamIndex: 0,
						title: "stored",
						messageCount: 1,
						lastMessageAt: new Date("2026-10-02T12:00:00Z"),
						lastAssistantAt: null,
						lastReadAt: null,
						agent: null,
						_count: { submissions: 1 },
						submissions: [{ id: "pending-test" }],
					},
				]),
			},
		} as unknown as Db;
		const service = new ConversationsService(db);
		const rows = await service.listBuilder("user-test");
		expect(rows[0]?.state).toBe("idle");
		expect(rows[0]?.ai).toMatchObject({
			enabled: false,
			code: "CRM_AI_DISABLED",
		});
		expect(network).not.toHaveBeenCalled();
	});

	it("reads run history and cancels a run locally without starting any new work", async () => {
		const tx = {
			$queryRaw: mock(async () => [
				{
					id: "run-test",
					agentId: "agent-test",
					versionId: "version-test",
					status: "RUNNING",
					initiatedById: "user-test",
					nextEventSequence: 1,
				},
			]),
			agentRun: { update: mock(async () => ({})) },
			agentAction: { updateMany: mock(async () => ({ count: 1 })) },
			agentRunEvent: { create: mock(async () => ({})) },
			agentAuditEvent: { upsert: mock(async () => ({})) },
		};
		const history = mock(async () => []);
		const db = {
			agentRun: { findMany: history },
			$transaction: async (
				work: (client: Prisma.TransactionClient) => Promise<unknown>,
			) => work(tx as unknown as Prisma.TransactionClient),
		} as unknown as Db;
		const access = {
			assertCanRead: mock(async () => ({ canManage: true })),
		} as unknown as AgentAccessService;
		const service = new AgentRunsService(
			db,
			access,
			new AgentTriggerService(db),
		);
		expect(await service.list("agent-test", 10, "user-test")).toEqual([]);
		expect(
			await service.cancelRun(
				{ id: "agent-test", runId: "run-test" },
				"user-test",
			),
		).toEqual({ id: "run-test", status: "CANCELLED", cancelled: true });
		expect(history).toHaveBeenCalledTimes(1);
		expect(tx.agentRun.update).toHaveBeenCalledTimes(1);
		expect(tx.agentAction.updateMany).toHaveBeenCalledTimes(1);
		expect(tx.agentRunEvent.create).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});
});
