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
import { Logger } from "@nestjs/common";
import type { ActivityStampService } from "../src/crm/activity-stamp.service";
import type { AuthedTrpcContext } from "../src/trpc/context.types";

const savedEnvironment = {
	NODE_ENV: process.env.NODE_ENV,
	TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
	ALLOWED_SIGN_IN: process.env.ALLOWED_SIGN_IN,
};
Object.assign(process.env, {
	NODE_ENV: "test",
	TEST_DATABASE_URL:
		"postgresql://unused:unused@127.0.0.1:65534/crm_tasks_test",
	BETTER_AUTH_SECRET: "synthetic-tasks-secret-not-an-active-credential",
	ALLOWED_SIGN_IN: "example.test",
});

const { ActivitiesService } = await import(
	"../src/activities/activities.service"
);
const { ActivitiesRouter } = await import(
	"../src/activities/activities.router"
);
const {
	activityCreateInput,
	activityEntryOutput,
	completeInput,
	myTasksInput,
	taskUpdateInput,
	timelineInput,
} = await import("../src/activities/activities.contracts");
const network = spyOn(globalThis, "fetch").mockRejectedValue(
	new Error("Network is forbidden in task tests."),
);
const logs = spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
const errors = spyOn(Logger.prototype, "error").mockImplementation(
	() => undefined,
);

afterAll(() => {
	network.mockRestore();
	logs.mockRestore();
	errors.mockRestore();
	for (const [key, value] of Object.entries(savedEnvironment)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

const now = new Date("2026-10-02T12:00:00.000Z");

function requiredFixture<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("Missing synthetic fixture record.");
	return value;
}
const deadline = "2026-10-04T15:00:00.000Z";
const actors = ["author", "assignee", "other", "admin", "owner"];
const user = (id: string) => ({
	id,
	name: `Synthetic ${id}`,
	email: `${id}@example.test`,
	image: null,
});

function taskRow() {
	return {
		id: "task-1",
		type: "TASK" as const,
		subject: "Prepare synthetic proposal",
		body: null as string | null,
		occurredAt: now as Date | null,
		dueAt: new Date(deadline) as Date | null,
		completedAt: null as Date | null,
		createdAt: now,
		createdById: "author",
		assigneeId: "assignee" as string | null,
		priority: 0,
		companyId: "company-1" as string | null,
		contactId: "contact-1" as string | null,
		dealId: "deal-1" as string | null,
		meta: null,
		createdBy: user("author"),
		assignee: user("assignee") as ReturnType<typeof user> | null,
		company: { id: "company-1", name: "Synthetic company" } as {
			id: string;
			name: string;
		} | null,
		contact: {
			id: "contact-1",
			firstName: "Synthetic",
			lastName: "Contact",
		} as { id: string; firstName: string; lastName: string } | null,
		deal: { id: "deal-1", name: "Synthetic deal" } as {
			id: string;
			name: string;
		} | null,
		emailThread: null,
		calendarEvent: null,
	};
}

function fixture() {
	const members = new Map(
		actors.map((id) => [id, id === "admin" || id === "owner" ? id : "member"]),
	);
	const companies = new Map(
		["company-1", "company-2"].map((id) => [
			id,
			{ id, archivedAt: null as Date | null },
		]),
	);
	const contacts = new Map([
		[
			"contact-1",
			{
				id: "contact-1",
				companyId: "company-1" as string | null,
				archivedAt: null as Date | null,
			},
		],
		[
			"contact-2",
			{
				id: "contact-2",
				companyId: "company-2" as string | null,
				archivedAt: null as Date | null,
			},
		],
	]);
	const deals = new Map([
		[
			"deal-1",
			{ id: "deal-1", companyId: "company-1", archivedAt: null as Date | null },
		],
		[
			"deal-2",
			{ id: "deal-2", companyId: "company-2", archivedAt: null as Date | null },
		],
	]);
	let row = taskRow();
	const activity = {
		findUnique: mock(async (args: Prisma.ActivityFindUniqueArgs) =>
			args.where.id === row.id ? { ...row } : null,
		),
		findMany: mock(async (_args: Prisma.ActivityFindManyArgs) => [{ ...row }]),
		count: mock(async (_args: Prisma.ActivityCountArgs) => 1),
		create: mock(async (args: Prisma.ActivityCreateArgs) => {
			const data = args.data as Prisma.ActivityUncheckedCreateInput;
			row = {
				...row,
				type: data.type as typeof row.type,
				subject: data.subject ?? "",
				body: data.body ?? null,
				assigneeId: data.assigneeId ?? null,
				priority: data.priority ?? 0,
				createdById: data.createdById,
				createdBy: user(data.createdById),
				assignee: data.assigneeId ? user(data.assigneeId) : null,
				occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
				dueAt: data.dueAt ? new Date(data.dueAt) : null,
				companyId: data.companyId ?? null,
				contactId: data.contactId ?? null,
				dealId: data.dealId ?? null,
				company: data.companyId
					? { id: data.companyId, name: "Synthetic company" }
					: null,
				contact: data.contactId
					? { id: data.contactId, firstName: "Synthetic", lastName: "Contact" }
					: null,
				deal: data.dealId ? { id: data.dealId, name: "Synthetic deal" } : null,
			};
			return { ...row };
		}),
		update: mock(async (args: Prisma.ActivityUpdateArgs) => {
			const data = args.data as {
				subject?: string;
				body?: string | null;
				assigneeId?: string;
				priority?: number;
				dueAt?: Date | null;
				completedAt?: Date | null;
			};
			row = {
				...row,
				...data,
				assignee: data.assigneeId ? user(data.assigneeId) : row.assignee,
			};
			return { ...row };
		}),
	};
	const tx = {
		activity,
		company: {
			findUnique: mock(
				async (args: Prisma.CompanyFindUniqueArgs) =>
					companies.get(args.where.id ?? "") ?? null,
			),
		},
		contact: {
			findUnique: mock(
				async (args: Prisma.ContactFindUniqueArgs) =>
					contacts.get(args.where.id ?? "") ?? null,
			),
		},
		deal: {
			findUnique: mock(
				async (args: Prisma.DealFindUniqueArgs) =>
					deals.get(args.where.id ?? "") ?? null,
			),
		},
		$queryRaw: mock(
			async (strings: TemplateStringsArray, ...values: string[]) => {
				if (strings.join("").includes('FROM "member"')) {
					const role = members.get(values[1] ?? "");
					return role ? [{ role }] : [];
				}
				return [];
			},
		),
	};
	const transaction = mock(
		async (
			work: (client: Prisma.TransactionClient) => Promise<unknown>,
			_options?: { isolationLevel: string },
		) => {
			const before = { ...row };
			try {
				return await work(tx as unknown as Prisma.TransactionClient);
			} catch (error) {
				row = before;
				throw error;
			}
		},
	);
	const member = {
		findFirst: mock(async (args: Prisma.MemberFindFirstArgs) => {
			const role = members.get(String(args.where?.userId));
			return role ? { role } : null;
		}),
	};
	const database = {
		...tx,
		member,
		$transaction: transaction,
	} as unknown as Db;
	const touch = mock(async () => undefined);
	const service = new ActivitiesService(database, {
		touch,
	} as unknown as ActivityStampService);
	return {
		service,
		activity,
		tx,
		transaction,
		member,
		members,
		companies,
		contacts,
		deals,
		touch,
		get row() {
			return row;
		},
	};
}

let f: ReturnType<typeof fixture>;
beforeEach(() => {
	f = fixture();
	network.mockClear();
	errors.mockClear();
});

function createInput(
	overrides: Partial<Parameters<typeof activityCreateInput.parse>[0]> = {},
) {
	return activityCreateInput.parse({
		type: "TASK",
		subject: "Synthetic task",
		companyId: "company-1",
		...overrides,
	});
}

function unchanged() {
	expect(f.activity.create).not.toHaveBeenCalled();
	expect(f.activity.update).not.toHaveBeenCalled();
	expect(f.touch).not.toHaveBeenCalled();
	expect(network).not.toHaveBeenCalled();
}

describe("task boundary contracts", () => {
	it("accepts all four priorities and rejects numbers outside the contract", () => {
		for (const priority of [0, 1, 2, 3])
			expect(
				taskUpdateInput.safeParse({ id: "task-1", priority }).success,
			).toBe(true);
		for (const priority of [-1, 4, 0.5, "1", null])
			expect(
				taskUpdateInput.safeParse({ id: "task-1", priority }).success,
			).toBe(false);
	});
	it("requires a nonblank subject and at least one relation on creation", () => {
		expect(
			activityCreateInput.safeParse({
				type: "TASK",
				subject: " ",
				companyId: "company-1",
			}).success,
		).toBe(false);
		expect(
			activityCreateInput.safeParse({ type: "TASK", subject: "Task" }).success,
		).toBe(false);
	});
	it("requires a supported zoned instant, preserving offsets", () => {
		for (const dueAt of [
			"2026-10-04T15:00:00Z",
			"2026-10-04T09:00:00-06:00",
			null,
		])
			expect(taskUpdateInput.safeParse({ id: "task-1", dueAt }).success).toBe(
				true,
			);
		for (const dueAt of [
			"2026-02-30T15:00:00Z",
			"2026-10-04",
			"2026-10-04T09:00",
			"",
			"not-a-date",
		])
			expect(taskUpdateInput.safeParse({ id: "task-1", dueAt }).success).toBe(
				false,
			);
	});
	it("rejects blank IDs, unknown fields, null assignees and empty changes", () => {
		for (const input of [
			{ id: "", priority: 1 },
			{ id: "task-1" },
			{ id: "task-1", createdById: "other", priority: 1 },
			{ id: "task-1", assigneeId: null },
			{ id: "task-1", assigneeId: " " },
		])
			expect(taskUpdateInput.safeParse(input).success).toBe(false);
	});
	it("rejects task-only fields on other activity types", () => {
		for (const fields of [
			{ priority: 0 },
			{ assigneeId: "author" },
			{ dueAt: null },
		])
			expect(
				activityCreateInput.safeParse({
					type: "NOTE",
					body: "Note",
					companyId: "company-1",
					...fields,
				}).success,
			).toBe(false);
	});
	it("rejects oversized subject and body", () => {
		expect(
			taskUpdateInput.safeParse({ id: "task-1", subject: "x".repeat(501) })
				.success,
		).toBe(false);
		expect(
			activityCreateInput.safeParse({
				type: "NOTE",
				body: "x".repeat(10001),
				companyId: "company-1",
			}).success,
		).toBe(false);
	});
	it("rejects a forged author at the create boundary", () => {
		expect(
			activityCreateInput.safeParse({
				type: "TASK",
				subject: "Task",
				companyId: "company-1",
				createdById: "other",
			}).success,
		).toBe(false);
	});
});

describe("task creation and consistent relations", () => {
	it("defaults assignment to the actor without rewriting authorship", async () => {
		const result = await f.service.create(createInput(), "author");
		expect(result.createdBy.id).toBe("author");
		expect(result.assignee?.id).toBe("author");
		expect(result.priority).toBe(0);
		expect(activityEntryOutput.safeParse(result).success).toBe(true);
		expect(f.transaction.mock.calls[0]?.[1]).toEqual({
			isolationLevel: "Serializable",
		});
		expect(f.tx.$queryRaw.mock.calls[0]?.[0].join("")).toContain("FOR SHARE");
		expect(network).not.toHaveBeenCalled();
	});
	for (const actor of ["admin", "owner"])
		it(`${actor} assigns another existing member`, async () => {
			const result = await f.service.create(
				createInput({ assigneeId: "assignee", priority: 3 }),
				actor,
			);
			expect(result.createdBy.id).toBe(actor);
			expect(result.assignee?.id).toBe("assignee");
			expect(result.priority).toBe(3);
		});
	it("rejects member creation for another assignee", async () => {
		await expect(
			f.service.create(createInput({ assigneeId: "assignee" }), "author"),
		).rejects.toThrow("Only an owner or admin");
		unchanged();
	});
	it("rejects a user without workspace membership", async () => {
		await expect(f.service.create(createInput(), "outsider")).rejects.toThrow(
			"membership",
		);
		unchanged();
	});
	it("rejects a nonexistent assignee even for an owner", async () => {
		await expect(
			f.service.create(createInput({ assigneeId: "missing" }), "owner"),
		).rejects.toThrow("membership");
		unchanged();
	});
	for (const role of ["viewer", "manager", "OWNER", "owner,member", ""])
		it(`rejects unsupported role '${role}'`, async () => {
			f.members.set("author", role);
			await expect(f.service.create(createInput(), "author")).rejects.toThrow(
				"supported role",
			);
			unchanged();
		});
	it("validates all supplied relations and infers the common company", async () => {
		const result = await f.service.create(
			activityCreateInput.parse({
				type: "TASK",
				subject: "Task",
				contactId: "contact-1",
				dealId: "deal-1",
			}),
			"author",
		);
		expect(result.company?.id).toBe("company-1");
		expect(result.contact?.id).toBe("contact-1");
		expect(result.deal?.id).toBe("deal-1");
		expect(f.tx.company.findUnique).toHaveBeenCalledTimes(1);
		expect(f.tx.contact.findUnique).toHaveBeenCalledTimes(1);
		expect(f.tx.deal.findUnique).toHaveBeenCalledTimes(1);
	});
	for (const relation of ["companyId", "contactId", "dealId"] as const)
		it(`rejects missing ${relation} despite another valid link`, async () => {
			await expect(
				f.service.create(createInput({ [relation]: "missing" }), "author"),
			).rejects.toThrow("No ");
			unchanged();
		});
	for (const links of [
		{ contactId: "contact-2" },
		{ dealId: "deal-2" },
		{ contactId: "contact-2", dealId: "deal-1" },
	])
		it(`rejects cross-company relations ${JSON.stringify(links)}`, async () => {
			await expect(
				f.service.create(createInput(links), "author"),
			).rejects.toThrow("another company");
			unchanged();
		});
	it("rejects linking a companyless contact to a company's opportunity", async () => {
		requiredFixture(f.contacts.get("contact-1")).companyId = null;
		await expect(
			f.service.create(
				createInput({ contactId: "contact-1", dealId: "deal-1" }),
				"author",
			),
		).rejects.toThrow("another company");
		unchanged();
	});
	it("allows standalone contact tasks without inventing a company", async () => {
		requiredFixture(f.contacts.get("contact-1")).companyId = null;
		const result = await f.service.create(
			activityCreateInput.parse({
				type: "TASK",
				subject: "Task",
				contactId: "contact-1",
			}),
			"author",
		);
		expect(result.company).toBeNull();
		expect(f.tx.company.findUnique).not.toHaveBeenCalled();
	});
	for (const kind of ["company", "contact", "deal"] as const)
		it(`rejects an archived ${kind}`, async () => {
			if (kind === "company")
				requiredFixture(f.companies.get("company-1")).archivedAt = now;
			if (kind === "contact")
				requiredFixture(f.contacts.get("contact-1")).archivedAt = now;
			if (kind === "deal")
				requiredFixture(f.deals.get("deal-1")).archivedAt = now;
			await expect(
				f.service.create(
					createInput({ contactId: "contact-1", dealId: "deal-1" }),
					"author",
				),
			).rejects.toThrow("Restore");
			unchanged();
		});
	it("keeps non-task authorship and leaves task fields empty", async () => {
		const result = await f.service.create(
			activityCreateInput.parse({
				type: "NOTE",
				body: "Manual note",
				companyId: "company-1",
			}),
			"author",
		);
		expect(result.createdBy.id).toBe("author");
		expect(result.assignee).toBeNull();
		expect(result.priority).toBe(0);
		expect(result.dueAt).toBeNull();
	});
	it("returns the committed record when a derived stamp fails", async () => {
		f.touch.mockRejectedValueOnce(new Error("Synthetic stamp failure"));
		const result = await f.service.create(createInput(), "author");
		expect(result.id).toBe("task-1");
		expect(f.activity.create).toHaveBeenCalledTimes(1);
		expect(errors).toHaveBeenCalledTimes(1);
	});
});

describe("task mutation authority and scheduling", () => {
	for (const actor of ["author", "assignee", "admin", "owner"])
		it(`${actor} completes and reopens a task`, async () => {
			const result = await f.service.complete("task-1", true, actor);
			expect(result.completedAt).not.toBeNull();
			const again = await f.service.complete("task-1", true, actor);
			expect(again.completedAt).toBe(result.completedAt);
			const reopened = await f.service.complete("task-1", false, actor);
			expect(reopened.completedAt).toBeNull();
			expect(reopened.createdBy.id).toBe("author");
			expect(reopened.assignee?.id).toBe("assignee");
			expect(
				f.tx.$queryRaw.mock.calls.some(([query]) =>
					query.join("").includes("FOR UPDATE"),
				),
			).toBe(true);
		});
	for (const actor of ["other", "outsider"])
		it(`rejects completion by ${actor}`, async () => {
			await expect(f.service.complete("task-1", true, actor)).rejects.toThrow();
			unchanged();
		});
	it("checks membership again after revocation", async () => {
		await f.service.complete("task-1", true, "assignee");
		f.activity.update.mockClear();
		f.members.delete("assignee");
		await expect(
			f.service.complete("task-1", false, "assignee"),
		).rejects.toThrow("membership");
		unchanged();
	});
	for (const actor of ["author", "assignee", "admin", "owner"])
		it(`${actor} edits, reschedules and changes priority without changing authorship`, async () => {
			const result = await f.service.updateTask(
				{
					id: "task-1",
					subject: "Updated task",
					body: "Details",
					dueAt: "2026-10-04T09:00:00-06:00",
					priority: 2,
				},
				actor,
			);
			expect(result.subject).toBe("Updated task");
			expect(result.body).toBe("Details");
			expect(result.priority).toBe(2);
			expect(result.dueAt).toBe(deadline);
			expect(result.createdBy.id).toBe("author");
			expect(result.assignee?.id).toBe("assignee");
		});
	it("clears the deadline and body explicitly", async () => {
		const result = await f.service.updateTask(
			{ id: "task-1", dueAt: null, body: " " },
			"assignee",
		);
		expect(result.dueAt).toBeNull();
		expect(result.body).toBeNull();
	});
	it("preserves unrelated fields on a partial edit", async () => {
		const result = await f.service.updateTask(
			{ id: "task-1", priority: 3 },
			"assignee",
		);
		expect(result.subject).toBe("Prepare synthetic proposal");
		expect(result.dueAt).toBe(deadline);
		expect(f.activity.update.mock.calls[0]?.[0].data).toEqual({ priority: 3 });
	});
	for (const actor of ["admin", "owner"])
		it(`${actor} reassigns without becoming the author`, async () => {
			const result = await f.service.updateTask(
				{ id: "task-1", assigneeId: "other" },
				actor,
			);
			expect(result.assignee?.id).toBe("other");
			expect(result.createdBy.id).toBe("author");
		});
	for (const actor of ["author", "assignee", "other"])
		it(`rejects reassignment by ${actor}`, async () => {
			await expect(
				f.service.updateTask({ id: "task-1", assigneeId: "other" }, actor),
			).rejects.toThrow();
			unchanged();
		});
	it("rejects self-claim by the author after reassignment", async () => {
		await expect(
			f.service.updateTask({ id: "task-1", assigneeId: "author" }, "author"),
		).rejects.toThrow("Only an owner or admin");
		unchanged();
	});
	it("allows preserving an unchanged assignee with an authorized edit", async () => {
		const result = await f.service.updateTask(
			{ id: "task-1", assigneeId: "assignee", priority: 1 },
			"assignee",
		);
		expect(result.assignee?.id).toBe("assignee");
	});
	it("rejects assignment to a revoked member and changes no other field", async () => {
		f.members.delete("other");
		await expect(
			f.service.updateTask(
				{ id: "task-1", assigneeId: "other", priority: 3 },
				"owner",
			),
		).rejects.toThrow("membership");
		expect(f.row.priority).toBe(0);
		unchanged();
	});
	it("checks changed linked-record consistency on completion and edits", async () => {
		requiredFixture(f.contacts.get("contact-1")).companyId = "company-2";
		await expect(f.service.complete("task-1", true, "owner")).rejects.toThrow(
			"another company",
		);
		await expect(
			f.service.updateTask({ id: "task-1", priority: 2 }, "owner"),
		).rejects.toThrow("another company");
		unchanged();
	});
	it("rejects editing an archived related record", async () => {
		requiredFixture(f.companies.get("company-1")).archivedAt = now;
		await expect(
			f.service.updateTask({ id: "task-1", dueAt: null }, "owner"),
		).rejects.toThrow("Restore");
		unchanged();
	});
	it("rejects missing tasks for both mutations", async () => {
		await expect(f.service.complete("missing", true, "owner")).rejects.toThrow(
			"No activity",
		);
		await expect(
			f.service.updateTask({ id: "missing", priority: 1 }, "owner"),
		).rejects.toThrow("No activity");
		unchanged();
	});
	it("rejects non-task activity mutations", async () => {
		f.activity.findUnique.mockResolvedValue({
			...taskRow(),
			type: "NOTE",
		} as never);
		await expect(f.service.complete("task-1", true, "owner")).rejects.toThrow(
			"Only tasks",
		);
		await expect(
			f.service.updateTask({ id: "task-1", priority: 1 }, "owner"),
		).rejects.toThrow("Only tasks");
		unchanged();
	});
	it("validates direct service calls before database access", async () => {
		await expect(
			f.service.updateTask({ id: "task-1", priority: 4 }, "owner"),
		).rejects.toThrow();
		await expect(f.service.complete("", true, "owner")).rejects.toThrow();
		expect(f.transaction).not.toHaveBeenCalled();
		unchanged();
	});
	it("returns an explicit conflict for a serializable transaction failure", async () => {
		f.transaction.mockRejectedValueOnce(
			Object.assign(new Error("Synthetic serialization conflict"), {
				code: "P2034",
			}),
		);
		await expect(
			f.service.updateTask({ id: "task-1", priority: 1 }, "owner"),
		).rejects.toThrow("Reload and retry");
		unchanged();
	});
	it("does not hide unexpected database errors", async () => {
		f.transaction.mockRejectedValueOnce(
			new Error("Synthetic persistence failure"),
		);
		await expect(f.service.complete("task-1", true, "owner")).rejects.toThrow(
			"Synthetic persistence failure",
		);
		unchanged();
	});
});

describe("assigned queue, timeline and router identity", () => {
	it("filters personal work by assignee, never author", async () => {
		await f.service.myTasks(myTasksInput.parse({ window: "all" }), "assignee");
		const query = f.activity.findMany.mock.calls[0]?.[0];
		expect(query?.where?.assigneeId).toBe("assignee");
		expect(query?.where?.createdById).toBeUndefined();
		expect(query?.where?.completedAt).toBeNull();
		expect(query?.orderBy).toEqual([
			{ priority: "desc" },
			{ dueAt: { sort: "asc", nulls: "last" } },
			{ createdAt: "desc" },
			{ id: "desc" },
		]);
		expect(query?.where?.AND).toHaveLength(3);
	});
	for (const window of ["overdue", "upcoming", "completed"] as const)
		it(`uses the ${window} queue predicate`, async () => {
			await f.service.myTasks(
				myTasksInput.parse({ window, limit: 7 }),
				"assignee",
			);
			const query = f.activity.findMany.mock.calls[0]?.[0];
			expect(query?.take).toBe(7);
			if (window === "completed")
				expect(query?.where?.completedAt).toEqual({ not: null });
			else
				expect(query?.where?.dueAt).toHaveProperty(
					window === "overdue" ? "lt" : "gte",
				);
		});
	it("returns distinct author, assignee and priority in the timeline", async () => {
		f.row.priority = 2;
		const result = await f.service.timeline(
			timelineInput.parse({ companyId: "company-1" }),
			"other",
		);
		expect(result.entries[0]?.createdBy.id).toBe("author");
		expect(result.entries[0]?.assignee?.id).toBe("assignee");
		expect(result.entries[0]?.priority).toBe(2);
	});
	it("denies all activity reads after membership removal", async () => {
		f.members.delete("assignee");
		await expect(
			f.service.myTasks(myTasksInput.parse({}), "assignee"),
		).rejects.toThrow("membership");
		await expect(
			f.service.timeline(
				timelineInput.parse({ companyId: "company-1" }),
				"assignee",
			),
		).rejects.toThrow("membership");
		await expect(
			f.service.timelineCounts({ companyId: "company-1" }, "assignee"),
		).rejects.toThrow("membership");
		expect(f.activity.findMany).not.toHaveBeenCalled();
		expect(f.activity.count).not.toHaveBeenCalled();
	});
	it("router mutations pass the server identity, not a caller-supplied author", async () => {
		const service = {
			create: mock(),
			complete: mock(),
			updateTask: mock(),
			timeline: mock(),
			timelineCounts: mock(),
			myTasks: mock(),
		};
		const router = new ActivitiesRouter(
			service as unknown as InstanceType<typeof ActivitiesService>,
		);
		const ctx = { user: { id: "server-actor" } } as AuthedTrpcContext;
		const input = createInput();
		await router.create(ctx, input);
		await router.complete(ctx, completeInput.parse({ id: "task-1" }));
		await router.updateTask(ctx, { id: "task-1", priority: 1 });
		expect(service.create).toHaveBeenCalledWith(input, "server-actor");
		expect(service.complete).toHaveBeenCalledWith(
			"task-1",
			true,
			"server-actor",
		);
		expect(service.updateTask).toHaveBeenCalledWith(
			{ id: "task-1", priority: 1 },
			"server-actor",
		);
	});
	it("uses no external network in the task flow", async () => {
		await f.service.create(createInput(), "author");
		await f.service.updateTask({ id: "task-1", dueAt: deadline }, "author");
		await f.service.complete("task-1", true, "author");
		expect(network).not.toHaveBeenCalled();
	});
});
