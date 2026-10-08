import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import type { Prisma } from "@crm/db";

const savedEnvironment = {
	NODE_ENV: process.env.NODE_ENV,
	TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
	ALLOWED_SIGN_IN: process.env.ALLOWED_SIGN_IN,
	AGENT_BRIDGE_SECRET: process.env.AGENT_BRIDGE_SECRET,
	AGENT_URL: process.env.AGENT_URL,
	BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
	CRM_AI_ENABLED: process.env.CRM_AI_ENABLED,
};
Object.assign(process.env, {
	NODE_ENV: "test",
	TEST_DATABASE_URL:
		"postgresql://unused:unused@127.0.0.1:65534/crm_ai_flows_test",
	BETTER_AUTH_SECRET: "ai-flow-test-secret-not-a-real-credential",
	ALLOWED_SIGN_IN: "example.test",
	AGENT_BRIDGE_SECRET: "ai-flow-test-bridge",
	AGENT_URL: "http://127.0.0.1:65534",
	BLOB_READ_WRITE_TOKEN: "ai-flow-test-blob-not-a-real-credential",
});
delete process.env.CRM_AI_ENABLED;

const network = spyOn(globalThis, "fetch").mockRejectedValue(
	new Error("Network is forbidden in AI flow tests."),
);
const { db } = await import("@crm/db");
const { AgentTriggerService } = await import(
	"../src/agent/agent-trigger.service"
);
const { AiPolicyDisabledException } = await import("../src/agent/ai-policy");
const { EnrichmentService } = await import(
	"../src/enrichment/enrichment.service"
);
const { ConversationSharingService } = await import(
	"../src/conversations/conversation-sharing.service"
);
const { CompaniesService } = await import("../src/companies/companies.service");
const { CompanyDirectoryService } = await import(
	"../src/companies/company-directory.service"
);
const { FaviconService } = await import("../src/companies/favicon.service");
const { ContactsService } = await import("../src/contacts/contacts.service");
const { FieldsService } = await import("../src/fields/fields.service");
const { BackfillService } = await import("../src/backfill/backfill.service");
const { ImageMirrorService } = await import(
	"../src/backfill/image-mirror.service"
);
const { SlackConnectionService } = await import(
	"../src/slack/slack-connection.service"
);
const { SlackChannelsService } = await import(
	"../src/slack/slack-channels.service"
);
const { queueSlackInventorySync } = await import("@crm/db/slack-inventory");
const { companyListInput, companyListOutput, companyDetailOutput } =
	await import("../src/companies/companies.contracts");
const { contactListInput, contactListOutput, contactByIdOutput } = await import(
	"../src/contacts/contacts.contracts"
);
const { fieldCreateInput } = await import("../src/fields/fields.contracts");
const { slackStatusOutput, slackMatchesOutput, slackChannelsOutput } =
	await import("../src/slack/slack.contracts");
const { sharedConversationOutput } = await import(
	"../src/conversations/conversations.contracts"
);

function dependencies<T>(value: object): T {
	return value as T;
}

function withMembership(value: object) {
	return {
		member: {
			findUnique: mock(async () => ({ role: "owner", suspendedAt: null })),
		},
		...value,
	};
}

function companies(
	database: object = {},
	agent: object = {},
	favicon: object = {},
	fields: object = {},
	queue: object = {},
	conversion: object = {},
) {
	return new CompaniesService(
		dependencies(withMembership(database)),
		dependencies(agent),
		dependencies(queue),
		dependencies(favicon),
		dependencies({}),
		dependencies(conversion),
		dependencies(fields),
	);
}

function contacts(
	database: object = {},
	agent: object = {},
	fields: object = {},
	queue: object = {},
	directory: object = {},
) {
	return new ContactsService(
		dependencies(withMembership(database)),
		dependencies(directory),
		dependencies(agent),
		dependencies(queue),
		dependencies({}),
		dependencies(fields),
	);
}

function backfill(
	database: object = {},
	agent: object = {},
	favicon: object = {},
	images: object = {},
	cache: object = {},
) {
	return new BackfillService(
		dependencies(database),
		dependencies(agent),
		dependencies(favicon),
		dependencies(images),
		dependencies(cache),
	);
}

function slack(
	database: object = {},
	agent: object = {},
	channels: object = {},
	access: object = {},
) {
	return new SlackConnectionService(
		dependencies(database),
		dependencies(agent),
		dependencies(channels),
		dependencies(access),
	);
}

function transactionFor(tx: object) {
	return mock(
		async (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
			work(
				dependencies(
					withMembership({
						$queryRaw: mock(async () => [
							{ id: "company-test", ownerId: "user-test", archivedAt: null },
						]),
						...tx,
					}),
				),
			),
	);
}

const createdAt = new Date("2026-10-02T12:00:00Z");

function companyRecord() {
	return {
		id: "company-test",
		name: "Synthetic Company",
		domain: "example.test",
		website: "https://example.test",
		description: null,
		logoUrl: null,
		logoDarkUrl: null,
		iconUrl: null,
		iconDarkUrl: null,
		iconTone: null,
		brandColor: null,
		industry: null,
		subIndustry: null,
		city: null,
		stateCode: null,
		country: null,
		countryCode: null,
		phone: null,
		email: null,
		linkedinUrl: null,
		twitterUrl: null,
		githubUrl: null,
		pricingUrl: null,
		careersUrl: null,
		enrichmentStatus: "PENDING",
		enrichmentError: null,
		source: "MANUAL",
		owner: null,
		contacts: [],
		deals: [],
		primaryContact: null,
		enrichedAt: null,
		createdAt,
		archivedAt: null,
		lastActivityAt: null,
		_count: { contacts: 0, deals: 0 },
	};
}

function contactRecord() {
	return {
		id: "contact-test",
		firstName: "Synthetic",
		lastName: "Contact",
		email: "person@example.test",
		phone: null,
		title: null,
		linkedinUrl: null,
		twitterUrl: null,
		githubUrl: null,
		imageUrl: null,
		enrichmentStatus: "RUNNING",
		enrichmentError: null,
		owner: null,
		company: null,
		deals: [],
		brief: null,
		facts: [],
		createdAt,
		archivedAt: null,
		source: "MANUAL",
		lastActivityAt: null,
	};
}

function fieldRecord() {
	return {
		id: "field-test",
		entity: "COMPANY",
		key: "industry",
		label: "Industry",
		type: "TEXT",
		agentFilled: true,
		agentBrief: "Synthetic brief",
		required: false,
		showOnSheet: true,
		showOnTable: false,
		showOnFilter: false,
		position: 0,
		archivedAt: null,
		options: [],
		createdAt,
		updatedAt: createdAt,
	};
}

function slackDatabase() {
	return {
		account: {
			findFirst: mock(async () => ({
				id: "account-test",
				accountId: "team-test",
				updatedAt: createdAt,
				scope: "users:read",
			})),
		},
		agentDefinition: { findMany: mock(async () => []) },
		slackMemberMatch: { findMany: mock(async () => []) },
		member: {
			count: mock(async () => 1),
			findMany: mock(async () => [
				{
					user: {
						id: "user-test",
						name: "Synthetic User",
						email: "user@example.test",
						slackMemberMatch: null,
					},
				},
			]),
		},
		slackWorkspaceGrant: { findFirst: mock(async () => null) },
		agentTask: {
			findFirst: mock(async () => ({
				createdAt,
				startedAt: createdAt,
				leasedUntil: new Date("2099-01-01T00:00:00Z"),
			})),
		},
		slackChannel: {
			findMany: mock(async () => [
				{
					id: "channel-test",
					name: "pilot-test",
					memberCount: 1,
					isPrivate: false,
					isMember: true,
					classifiedAt: createdAt,
					inviteRequestedAt: null,
				},
			]),
		},
	};
}

describe("enrichment queue policy", () => {
	it("returns idle without database reads when disabled", async () => {
		const service = new EnrichmentService(dependencies({}));
		expect(await service.queue()).toEqual({
			rows: [],
			total: 0,
			scheduled: [],
			scheduledTotal: 0,
		});
		expect(network).not.toHaveBeenCalled();
	});
	it("does not resolve subjects after policy changes during task reads", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const findMany = mock(async () => {
			delete process.env.CRM_AI_ENABLED;
			return [{ id: "task-test", companyId: "company-test", contactId: null }];
		});
		const service = new EnrichmentService(
			dependencies({ agentTask: { findMany, count: mock(async () => 1) } }),
		);
		expect(await service.queue()).toEqual({
			rows: [],
			total: 0,
			scheduled: [],
			scheduledTotal: 0,
		});
		expect(findMany).toHaveBeenCalledTimes(2);
	});
	it("reports stored work only while explicitly enabled", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const findMany = mock(async () => []);
		const count = mock(async () => 0);
		const service = new EnrichmentService(
			dependencies({ agentTask: { findMany, count } }),
		);
		expect(await service.queue()).toEqual({
			rows: [],
			total: 0,
			scheduled: [],
			scheduledTotal: 0,
		});
		expect(findMany).toHaveBeenCalledTimes(2);
		expect(count).toHaveBeenCalledTimes(2);
	});
});

describe("shared history policy", () => {
	for (const enabled of [false, true]) {
		it(`returns current policy with retained history enabled=${enabled}`, async () => {
			if (enabled) process.env.CRM_AI_ENABLED = "true";
			const service = new ConversationSharingService(
				dependencies({
					member: { findUnique: mock(async () => ({ id: "member-test" })) },
					agentConversationShare: {
						findFirst: mock(async () => ({
							conversation: {
								id: "chat-test",
								title: "Synthetic history",
								sessionId: null,
								lastMessageAt: createdAt,
								user: { name: "Synthetic owner" },
								agent: null,
								builderArtifacts: [],
								submissions: [],
							},
						})),
					},
					agentEvent: { findMany: mock(async () => []) },
				}),
			);
			const result = sharedConversationOutput.parse(
				await service.resolve("synthetic-token", "user-test"),
			);
			expect(result.ai.enabled).toBe(enabled);
			expect(result.title).toBe("Synthetic history");
			expect(network).not.toHaveBeenCalled();
		});
	}
	it("does not bypass workspace membership when AI is disabled", async () => {
		const service = new ConversationSharingService(
			dependencies({ member: { findUnique: mock(async () => null) } }),
		);
		await expect(
			service.resolve("synthetic-token", "outsider-test"),
		).rejects.toThrow("another team");
	});
});

beforeEach(() => {
	delete process.env.CRM_AI_ENABLED;
	network.mockClear();
	network.mockRejectedValue(
		new Error("Network is forbidden in AI flow tests."),
	);
});

afterAll(async () => {
	network.mockRestore();
	await db.$disconnect();
	for (const [key, value] of Object.entries(savedEnvironment)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("explicit AI flow entry points", () => {
	const operations = [
		["company enrich", () => companies().enrich("company-test", "user-test")],
		[
			"company research",
			() => companies().research("company-test", "user-test"),
		],
		["company bulk enrich", () => companies().bulkEnrich([], "user-test")],
		["contact enrich", () => contacts().enrich("contact-test", "user-test")],
		["contact bulk enrich", () => contacts().bulkEnrich([], "user-test")],
		[
			"field backfill",
			() =>
				new FieldsService(dependencies({}), dependencies({})).backfill(
					"field-test",
				),
		],
		["Slack people refresh", () => slack().refreshPeople("user-test")],
		[
			"Slack channel join",
			() => slack().joinChannel({ channelId: "channel-test" }, "user-test"),
		],
		[
			"Slack channel create",
			() =>
				slack().createChannel(
					{ name: "pilot-test", isPrivate: false },
					"user-test",
				),
		],
		[
			"Slack bridge create",
			() => new SlackChannelsService().create("pilot-test", false),
		],
	] as const;
	for (const [name, operation] of operations) {
		it(`rejects ${name} before dependency reads or writes`, async () => {
			await expect(operation()).rejects.toBeInstanceOf(
				AiPolicyDisabledException,
			);
			expect(network).not.toHaveBeenCalled();
		});
	}
	for (const scope of ["companies", "contacts", "deals"] as const) {
		it(`rejects explicit ${scope} backfill before database reads`, async () => {
			await expect(backfill().run(scope)).rejects.toBeInstanceOf(
				AiPolicyDisabledException,
			);
		});
	}
});

describe("automatic flow policy", () => {
	it("does not read or stamp the automatic backfill cache", async () => {
		const cache = { get: mock(async () => null), set: mock(async () => {}) };
		expect(await backfill({}, {}, {}, {}, cache).auto()).toEqual({
			started: false,
		});
		expect(cache.get).not.toHaveBeenCalled();
		expect(cache.set).not.toHaveBeenCalled();
	});
	it("does not query field definitions for a newly created record", async () => {
		const findMany = mock(async () => []);
		const service = new FieldsService(
			dependencies({ fieldDefinition: { findMany } }),
			dependencies({}),
		);
		await service.queueBackfillForNewRecord("COMPANY", "company-test");
		expect(findMany).not.toHaveBeenCalled();
	});
	it("does not start a Slack inventory transaction", async () => {
		const transaction = mock(async () => {});
		await queueSlackInventorySync(
			"synthetic login",
			dependencies({ $transaction: transaction }),
		);
		expect(transaction).not.toHaveBeenCalled();
	});
	it("does not resolve favicons despite configured providers", async () => {
		expect(
			await new FaviconService(dependencies({})).backfill(
				"company-test",
				"example.test",
			),
		).toBe(false);
		expect(network).not.toHaveBeenCalled();
	});
	it("does not scan or mirror images despite a configured blob token", async () => {
		expect(await new ImageMirrorService(dependencies({})).sweep()).toEqual({
			scanned: 0,
			copied: 0,
		});
		expect(network).not.toHaveBeenCalled();
	});
	it("stops automatic backfill when policy changes during the cache read", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const cache = {
			get: mock(async () => {
				delete process.env.CRM_AI_ENABLED;
				return null;
			}),
			set: mock(async () => {}),
		};
		expect(await backfill({}, {}, {}, {}, cache).auto()).toEqual({
			started: false,
		});
		expect(cache.set).not.toHaveBeenCalled();
	});
	it("stops image sweeps when policy changes during the first scan", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const company = {
			findMany: mock(async () => {
				delete process.env.CRM_AI_ENABLED;
				return [
					{ id: "company-test", iconUrl: "https://example.test/icon.png" },
				];
			}),
		};
		const contact = { findMany: mock(async () => []) };
		const user = { findMany: mock(async () => []) };
		expect(
			await new ImageMirrorService(
				dependencies({ company, contact, user }),
			).sweep(),
		).toEqual({ scanned: 1, copied: 0 });
		expect(contact.findMany).not.toHaveBeenCalled();
		expect(user.findMany).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});
});

describe("manual CRM operations with disabled AI", () => {
	it("creates a company with skipped enrichment and no automatic work", async () => {
		const create = mock(async (_input: Prisma.CompanyCreateArgs) =>
			companyRecord(),
		);
		const tx = { company: { create, findFirst: mock(async () => null) } };
		const database = { ...tx, $transaction: transactionFor(tx) };
		const agent = new AgentTriggerService(dependencies(database));
		const requested = spyOn(agent, "companyCreated");
		const favicon = { backfill: mock(async () => false) };
		const fields = { queueBackfillForNewRecord: mock(async () => {}) };
		expect(
			await companies(database, agent, favicon, fields).create(
				{
					name: "Synthetic Company",
					domain: "example.test",
				},
				"user-test",
			),
		).toEqual({
			id: "company-test",
			name: "Synthetic Company",
			domain: "example.test",
		});
		expect(create.mock.calls[0]?.[0].data).toMatchObject({
			enrichmentStatus: "SKIPPED",
		});
		expect(database.$transaction).toHaveBeenCalledTimes(1);
		expect(requested).not.toHaveBeenCalled();
		expect(favicon.backfill).not.toHaveBeenCalled();
		expect(fields.queueBackfillForNewRecord).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});
	it("saves domain and field edits without pending research", async () => {
		const update = mock(async (_input: Prisma.CompanyUpdateArgs) => ({
			id: "company-test",
			name: "Synthetic Company",
			domain: "new.example.test",
		}));
		const tx = {
			company: {
				update,
				findUniqueOrThrow: mock(async () => ({ domain: "old.example.test" })),
			},
		};
		const database = {
			company: {
				findUnique: mock(async () => ({ domain: "old.example.test" })),
			},
			$transaction: transactionFor(tx),
		};
		const agent = { companyCreated: mock(async () => {}) };
		const favicon = { backfill: mock(async () => false) };
		const fields = { applyValues: mock(async () => {}) };
		const result = await companies(database, agent, favicon, fields).update(
			"company-test",
			{ domain: "new.example.test", fields: { industry: "Manual industry" } },
			"user-test",
		);
		expect(result.domain).toBe("new.example.test");
		expect(update.mock.calls[0]?.[0].data).toMatchObject({
			domain: "new.example.test",
			enrichmentStatus: "SKIPPED",
		});
		expect(fields.applyValues).toHaveBeenCalledTimes(1);
		expect(agent.companyCreated).not.toHaveBeenCalled();
		expect(favicon.backfill).not.toHaveBeenCalled();
	});
	it("preserves email domain association without research tasks", async () => {
		const create = mock(async (_input: Prisma.CompanyCreateArgs) =>
			companyRecord(),
		);
		const tx = {
			$queryRaw: mock(async () => [{ locked: true }]),
			company: { findFirst: mock(async () => null), create },
		};
		const database = { $transaction: transactionFor(tx) };
		const agent = new AgentTriggerService(dependencies(database));
		const requested = spyOn(agent, "companyCreated");
		expect(
			await new CompanyDirectoryService(agent).companyForEmail(
				"person@example.test",
			),
		).toBe("company-test");
		expect(create.mock.calls[0]?.[0].data).toMatchObject({
			enrichmentStatus: "SKIPPED",
		});
		expect(requested).not.toHaveBeenCalled();
		expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
	});
	it("creates a contact and preserves its company association without automatic work", async () => {
		const create = mock(async (_input: Prisma.ContactCreateArgs) => ({
			...contactRecord(),
			companyId: "company-test",
		}));
		const tx = {
			contact: { create },
			suppressedContact: { deleteMany: mock(async () => ({ count: 0 })) },
		};
		const database = {
			...tx,
			contact: { create, findFirst: mock(async () => null) },
			$transaction: transactionFor(tx),
		};
		const agent = new AgentTriggerService(dependencies(database));
		const requested = spyOn(agent, "contactCreated");
		const fields = { queueBackfillForNewRecord: mock(async () => {}) };
		const directory = { companyForContact: mock(async () => "company-test") };
		const result = await contacts(
			database,
			agent,
			fields,
			{},
			directory,
		).create(
			{
				firstName: "Synthetic",
				lastName: "Contact",
				email: "person@example.test",
			},
			"user-test",
		);
		expect(result.id).toBe("contact-test");
		expect(create.mock.calls[0]?.[0].data).toMatchObject({
			enrichmentStatus: "SKIPPED",
			companyId: "company-test",
		});
		expect(directory.companyForContact).toHaveBeenCalledTimes(1);
		expect(requested).not.toHaveBeenCalled();
		expect(fields.queueBackfillForNewRecord).not.toHaveBeenCalled();
	});
	it("preserves a manual write failure instead of returning success", async () => {
		const failure = new Error("Synthetic manual failure");
		const tx = {
			company: {
				create: mock(async () => {
					throw failure;
				}),
			},
		};
		const database = { $transaction: transactionFor(tx) };
		await expect(
			companies(
				database,
				new AgentTriggerService(dependencies(database)),
			).create({ name: "Synthetic Company" }, "user-test"),
		).rejects.toBe(failure);
	});
	it("creates an agent-filled field configuration without scanning records", async () => {
		const definition = fieldRecord();
		const create = mock(async () => definition);
		const records = { findMany: mock(async () => []) };
		const agent = {
			fieldBackfillRecords: mock(async () => ({ queued: 1, merged: 0 })),
		};
		const database = {
			fieldDefinition: {
				findUnique: mock(async () => null),
				findFirst: mock(async () => null),
				create,
			},
			company: records,
		};
		const service = new FieldsService(
			dependencies(database),
			dependencies(agent),
		);
		const result = await service.create(
			fieldCreateInput.parse({
				entity: "COMPANY",
				label: "Industry",
				type: "TEXT",
			}),
		);
		expect(result.agentFilled).toBe(true);
		expect(create).toHaveBeenCalledTimes(1);
		expect(records.findMany).not.toHaveBeenCalled();
		expect(agent.fieldBackfillRecords).not.toHaveBeenCalled();
	});
	it("updates an agent-filled field brief without scanning records", async () => {
		const definition = fieldRecord();
		const tx = {
			fieldDefinition: {
				update: mock(async () => ({
					...definition,
					agentBrief: "New synthetic brief",
				})),
			},
		};
		const records = { findMany: mock(async () => []) };
		const agent = {
			fieldBackfillRecords: mock(async () => ({ queued: 1, merged: 0 })),
		};
		const database = {
			fieldDefinition: { findUnique: mock(async () => definition) },
			company: records,
			$transaction: transactionFor(tx),
		};
		const result = await new FieldsService(
			dependencies(database),
			dependencies(agent),
		).update("field-test", { agentBrief: "New synthetic brief" });
		expect(result.agentBrief).toBe("New synthetic brief");
		expect(tx.fieldDefinition.update).toHaveBeenCalledTimes(1);
		expect(records.findMany).not.toHaveBeenCalled();
		expect(agent.fieldBackfillRecords).not.toHaveBeenCalled();
	});
	it("allows local Slack disconnection while preserving its owner check", async () => {
		const tx = {
			account: { deleteMany: mock(async () => ({ count: 1 })) },
			slackChannel: { deleteMany: mock(async () => ({ count: 1 })) },
			slackWorkspaceGrant: { deleteMany: mock(async () => ({ count: 1 })) },
		};
		const database = { $transaction: transactionFor(tx) };
		expect(
			await slack(
				database,
				{},
				{},
				{ assertMember: mock(async () => "owner") },
			).disconnect("user-test"),
		).toEqual({ disconnected: true });
		await expect(
			slack(
				database,
				{},
				{},
				{ assertMember: mock(async () => "member") },
			).disconnect("user-test"),
		).rejects.toThrow("Only an owner or an admin");
		expect(database.$transaction).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});
});

describe("truthful read status with disabled AI", () => {
	it("returns a company list with stored history but no operational queue", async () => {
		const row = companyRecord();
		const database = {
			company: {
				findMany: mock(async () => [row]),
				count: mock(async () => 1),
				groupBy: mock(async () => []),
			},
		};
		const fields = {
			filterableFieldsFor: mock(async () => []),
			tableValuesFor: mock(async () => new Map()),
			fieldFilters: mock(() => []),
			filterFacetCounts: mock(async () => ({})),
		};
		const queue = { queuedCompanies: mock(async () => new Set([row.id])) };
		const result = await companies(database, {}, {}, fields, queue).list(
			companyListInput.parse({}),
			"user-test",
		);
		expect(companyListOutput.parse(result).rows[0]).toMatchObject({
			enrichmentStatus: "PENDING",
			queued: false,
			ai: { status: "disabled", code: "CRM_AI_DISABLED" },
		});
		expect(queue.queuedCompanies).not.toHaveBeenCalled();
	});
	it("returns company detail without reading the old active queue", async () => {
		const database = {
			company: { findUnique: mock(async () => companyRecord()) },
		};
		const queue = { isQueued: mock(async () => true) };
		const result = await companies(
			database,
			{},
			{},
			{ valuesFor: mock(async () => []) },
			queue,
			{ reportingCurrency: mock(async () => "MXN") },
		).byId("company-test", "user-test");
		expect(companyDetailOutput.parse(result)).toMatchObject({
			queued: false,
			enrichmentStatus: "PENDING",
			ai: { enabled: false },
		});
		expect(queue.isQueued).not.toHaveBeenCalled();
	});
	it("returns contact lists without changing manual fields", async () => {
		const database = {
			contact: {
				findMany: mock(async () => [contactRecord()]),
				count: mock(async () => 1),
				groupBy: mock(async () => []),
			},
		};
		const fields = {
			filterableFieldsFor: mock(async () => []),
			tableValuesFor: mock(async () => new Map()),
			fieldFilters: mock(() => []),
			filterFacetCounts: mock(async () => ({})),
		};
		const result = await contacts(database, {}, fields).list(
			contactListInput.parse({}),
			"user-test",
		);
		expect(contactListOutput.parse(result).rows[0]).toMatchObject({
			firstName: "Synthetic",
			email: "person@example.test",
			ai: { enabled: false },
		});
	});
	it("returns contact detail with historical RUNNING state but no active queue", async () => {
		const database = {
			contact: { findUnique: mock(async () => contactRecord()) },
			emailThread: {
				aggregate: mock(async () => ({
					_sum: { messageCount: 0 },
					_count: { _all: 0 },
				})),
			},
			emailMessage: { findFirst: mock(async () => null) },
			calendarEvent: {
				count: mock(async () => 0),
				findFirst: mock(async () => null),
			},
		};
		const queue = { isQueued: mock(async () => true) };
		const result = await contacts(
			database,
			{},
			{ valuesFor: mock(async () => []) },
			queue,
		).byId("contact-test", "user-test");
		expect(contactByIdOutput.parse(result)).toMatchObject({
			enrichmentStatus: "RUNNING",
			queued: false,
			ai: { enabled: false },
		});
		expect(queue.isQueued).not.toHaveBeenCalled();
	});
	it("returns stale Slack connection data without requesting inventory", async () => {
		const agent = { slackPeopleRequested: mock(async () => true) };
		const result = await slack(
			slackDatabase(),
			agent,
			{},
			{ assertMember: mock(async () => "owner") },
		).status("user-test");
		expect(slackStatusOutput.parse(result)).toMatchObject({
			connected: true,
			ai: { enabled: false },
			people: { matched: 0, reviewed: 0 },
		});
		expect(agent.slackPeopleRequested).not.toHaveBeenCalled();
	});
	it("returns Slack matches without calling a stored task syncing", async () => {
		const database = slackDatabase();
		const result = await slack(
			database,
			{},
			{},
			{ assertMember: mock(async () => "member") },
		).matches("user-test");
		expect(slackMatchesOutput.parse(result)).toMatchObject({
			sync: "idle",
			ai: { enabled: false },
			rows: [{ crmUserId: "user-test" }],
		});
		expect(database.agentTask.findFirst).not.toHaveBeenCalled();
	});
	it("returns cached Slack channels without task polling", async () => {
		const database = slackDatabase();
		const result = await slack(
			database,
			{},
			{},
			{ assertMember: mock(async () => "member") },
		).channels({}, "user-test");
		expect(slackChannelsOutput.parse(result)).toMatchObject({
			sync: "idle",
			ai: { enabled: false },
			rows: [{ id: "channel-test", isMember: true }],
		});
		expect(database.agentTask.findFirst).not.toHaveBeenCalled();
	});
});

describe("explicit opt-in keeps permitted flows available", () => {
	for (const kind of ["company", "contact"] as const) {
		it(`queues explicit ${kind} research only after opt-in`, async () => {
			process.env.CRM_AI_ENABLED = "true";
			const record = {
				id: `${kind}-test`,
				updatedAt: createdAt,
				imageUrl: null,
				linkedinUrl: null,
			};
			const update = mock(async () => ({ count: 1 }));
			const database = {
				$transaction: transactionFor({
					[kind]: { findUniqueOrThrow: mock(async () => record), update },
				}),
			};
			const request = mock(async () => true);
			const agent = {
				companyRequested: request,
				contactCreated: request,
				drainQueues: mock(() => {}),
			};
			const service =
				kind === "company"
					? companies(database, agent)
					: contacts(database, agent);
			expect(await service.enrich(record.id, "user-test")).toEqual({
				id: record.id,
				queued: true,
			});
			expect(request).toHaveBeenCalledTimes(1);
			expect(update).toHaveBeenCalledTimes(1);
		});
		it(`does not report a queued ${kind} after policy changes`, async () => {
			process.env.CRM_AI_ENABLED = "true";
			const record = {
				id: `${kind}-test`,
				updatedAt: createdAt,
				imageUrl: null,
				linkedinUrl: null,
			};
			const update = mock(async () => ({ count: 1 }));
			const database = {
				$transaction: transactionFor({
					[kind]: { findUniqueOrThrow: mock(async () => record), update },
				}),
			};
			const request = mock(async () => {
				delete process.env.CRM_AI_ENABLED;
				return true;
			});
			const agent = {
				companyRequested: request,
				contactCreated: request,
				drainQueues: mock(() => {}),
			};
			const service =
				kind === "company"
					? companies(database, agent)
					: contacts(database, agent);
			expect(await service.enrich(record.id, "user-test")).toEqual({
				id: record.id,
				queued: false,
			});
			expect(update).not.toHaveBeenCalled();
		});
	}
	it("permits explicit field backfill after opt-in", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const agent = {
			fieldBackfillRecords: mock(async () => ({ queued: 1, merged: 0 })),
		};
		const database = {
			fieldDefinition: { findUnique: mock(async () => fieldRecord()) },
			company: { findMany: mock(async () => [{ id: "company-test" }]) },
		};
		expect(
			await new FieldsService(
				dependencies(database),
				dependencies(agent),
			).backfill("field-test"),
		).toEqual({ queued: true });
		expect(agent.fieldBackfillRecords).toHaveBeenCalledTimes(1);
	});
	it("permits company backfill after opt-in", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const database = {
			agentTask: { findMany: mock(async () => []) },
			company: {
				count: mock(async () => 1),
				findMany: mock(async () => [{ id: "company-test" }]),
			},
		};
		const agent = {
			backfill: mock(async () => ({ queued: 1, alreadyQueued: 0 })),
		};
		expect(await backfill(database, agent).run("deals")).toEqual({
			queued: 2,
			alreadyQueued: 0,
			remaining: 0,
			iconsResolving: 0,
		});
		expect(agent.backfill).toHaveBeenCalledTimes(2);
	});
	it("stops a backfill between database reads and task creation", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const database = {
			agentTask: {
				findMany: mock(async () => {
					delete process.env.CRM_AI_ENABLED;
					return [];
				}),
			},
		};
		const agent = {
			backfill: mock(async () => ({ queued: 1, alreadyQueued: 0 })),
		};
		expect(await backfill(database, agent).run("companies")).toEqual({
			queued: 0,
			alreadyQueued: 0,
			remaining: 0,
			iconsResolving: 0,
		});
		expect(agent.backfill).not.toHaveBeenCalled();
	});
	it("permits Slack channel creation using only a mock bridge response", async () => {
		process.env.CRM_AI_ENABLED = "true";
		network.mockResolvedValue(
			Response.json({ channel: { id: "channel-test", name: "pilot-test" } }),
		);
		expect(
			await new SlackChannelsService().create("pilot-test", false),
		).toEqual({ channel: { id: "channel-test", name: "pilot-test" } });
		expect(network).toHaveBeenCalledTimes(1);
	});
	it("permits stale Slack inventory refresh after opt-in", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const agent = { slackPeopleRequested: mock(async () => true) };
		const service = slack(
			slackDatabase(),
			agent,
			{},
			{ assertMember: mock(async () => "owner") },
		);
		expect((await service.status("user-test")).ai).toEqual({
			enabled: true,
			status: "enabled",
		});
		expect(await service.refreshPeople("user-test")).toEqual({
			requested: true,
		});
		expect(agent.slackPeopleRequested).toHaveBeenCalledTimes(2);
	});
	it("rejects private Slack invite stamping when policy changes before the write", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const update = mock(async () => ({}));
		const database = {
			slackChannel: {
				findUnique: mock(async () => ({
					id: "channel-test",
					name: "pilot-test",
					isMember: false,
					isPrivate: true,
				})),
				update,
			},
			slackWorkspaceGrant: {
				findFirst: mock(async () => {
					delete process.env.CRM_AI_ENABLED;
					return null;
				}),
			},
		};
		await expect(
			slack(
				database,
				{},
				{},
				{ assertMember: mock(async () => "member") },
			).joinChannel({ channelId: "channel-test" }, "user-test"),
		).rejects.toBeInstanceOf(AiPolicyDisabledException);
		expect(update).not.toHaveBeenCalled();
	});
});

describe("shared Slack inventory writer", () => {
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
		it(`does not transact for opt-in value ${JSON.stringify(value)}`, async () => {
			if (value !== undefined) process.env.CRM_AI_ENABLED = value;
			const transaction = mock(async () => {});
			await queueSlackInventorySync(
				"synthetic login",
				dependencies({ $transaction: transaction }),
			);
			expect(transaction).not.toHaveBeenCalled();
		});
	}
	for (const recent of [false, true]) {
		it(`preserves inventory throttle with recent task=${recent}`, async () => {
			process.env.CRM_AI_ENABLED = "true";
			const create = mock(async (_input: Prisma.AgentTaskCreateArgs) => ({
				id: "task-test",
			}));
			const tx = {
				$queryRaw: mock(async () => [{ locked: true }]),
				agentTask: {
					findFirst: mock(async () => (recent ? { id: "recent-test" } : null)),
					create,
				},
			};
			const transaction = transactionFor(tx);
			await queueSlackInventorySync(
				"synthetic login",
				dependencies({ $transaction: transaction }),
			);
			expect(transaction).toHaveBeenCalledTimes(1);
			expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
			expect(create).toHaveBeenCalledTimes(recent ? 0 : 1);
			if (!recent)
				expect(create.mock.calls[0]?.[0].data).toMatchObject({
					kind: "slack-people-match",
					reason: "synthetic login",
				});
			expect(network).not.toHaveBeenCalled();
		});
	}
	it("creates no task when policy changes during throttle lookup", async () => {
		process.env.CRM_AI_ENABLED = "true";
		const create = mock(async () => ({ id: "task-test" }));
		const tx = {
			$queryRaw: mock(async () => [{ locked: true }]),
			agentTask: {
				findFirst: mock(async () => {
					delete process.env.CRM_AI_ENABLED;
					return null;
				}),
				create,
			},
		};
		await queueSlackInventorySync(
			"synthetic login",
			dependencies({ $transaction: transactionFor(tx) }),
		);
		expect(create).not.toHaveBeenCalled();
	});
});
