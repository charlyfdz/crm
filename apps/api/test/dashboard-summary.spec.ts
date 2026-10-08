import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	setSystemTime,
	spyOn,
} from "bun:test";
import type { Db, Prisma as P } from "@crm/db";
import { z } from "zod";
import { Prisma } from "../../../packages/db/src/generated/prisma/client";
import {
	ActivityType,
	DealStage,
} from "../../../packages/db/src/generated/prisma/enums";

mock.module("@crm/db", () => ({ Prisma, ActivityType, DealStage }));

const { ConversionService } = await import(
	"../src/currency/conversion.service"
);
const { DashboardService } = await import("../src/dashboard/dashboard.service");
const { dashboardSummaryOutput } = await import(
	"../src/dashboard/dashboard.contracts"
);
const network = spyOn(globalThis, "fetch").mockRejectedValue(
	new Error("Network is forbidden in dashboard tests."),
);
const NOW = new Date(2026, 9, 2, 12);
const OWNER = "owner-synthetic";
const OTHER = "other-synthetic";
const DAY_MS = 86_400_000;

type StringFilter =
	| string
	| null
	| { equals?: string | null; in?: string[] | null; not?: StringFilter };
type DateFilter =
	| Date
	| string
	| null
	| {
			equals?: Date | string | null;
			gte?: Date | string;
			lt?: Date | string;
			lte?: Date | string;
			not?: DateFilter;
	  };
const stringPredicate: z.ZodType<StringFilter> = z.lazy(() =>
	z.union([
		z.string(),
		z.null(),
		z.strictObject({
			equals: z.string().nullable().optional(),
			in: z.array(z.string()).nullable().optional(),
			not: stringPredicate.optional(),
		}),
	]),
);
const dateValue = z.union([z.date(), z.string()]);
const datePredicate: z.ZodType<DateFilter> = z.lazy(() =>
	z.union([
		dateValue,
		z.null(),
		z.strictObject({
			equals: dateValue.nullable().optional(),
			gte: dateValue.optional(),
			lt: dateValue.optional(),
			lte: dateValue.optional(),
			not: datePredicate.optional(),
		}),
	]),
);
const amountPredicate = z.union([
	z.null(),
	z.number(),
	z.string(),
	z.instanceof(Prisma.Decimal),
	z.strictObject({ not: z.null() }),
]);
type FixtureDeal = {
	id: string;
	name: string;
	ownerId: string;
	stage: DealStage;
	pipelineStageId: string | null;
	amount: Prisma.Decimal | null;
	currency: string;
	baseAmount: Prisma.Decimal | null;
	baseCurrency: string | null;
	archivedAt: Date | null;
	createdAt: Date;
	closedAt: Date | null;
	expectedCloseDate: Date | null;
	stageChangedAt: Date;
};
type FixtureActivity = {
	id: string;
	type: ActivityType;
	createdById: string;
	assigneeId: string | null;
	dealId: string | null;
	createdAt: Date;
	dueAt: Date | null;
	completedAt: Date | null;
};
type Read = {
	model: "deal" | "activity";
	operation: "groupBy" | "count" | "aggregate" | "findMany";
	ids: string[];
};

function date(month: number, day: number) {
	return new Date(2026, month - 1, day, 12);
}
function deal(id: string, changes: Partial<FixtureDeal> = {}): FixtureDeal {
	return {
		id,
		name: `Synthetic ${id}`,
		ownerId: OWNER,
		stage: DealStage.DEMO_BOOKED,
		pipelineStageId: null,
		amount: new Prisma.Decimal("999999"),
		currency: "MXN",
		baseAmount: new Prisma.Decimal("100"),
		baseCurrency: "MXN",
		archivedAt: null,
		createdAt: date(9, 10),
		closedAt: null,
		expectedCloseDate: date(10, 20),
		stageChangedAt: date(9, 10),
		...changes,
	};
}
function fixtureDeals(): FixtureDeal[] {
	return [
		deal("open-100"),
		deal("open-200", {
			stage: DealStage.QUALIFIED_TO_BUY,
			currency: "USD",
			baseAmount: new Prisma.Decimal("200"),
		}),
		deal("open-zero", {
			stage: DealStage.DECISION_MAKER_BOUGHT_IN,
			baseAmount: new Prisma.Decimal("0"),
		}),
		deal("pending-null-amount", { baseAmount: null }),
		deal("pending-null-base", {
			stage: DealStage.CONTRACT_SENT,
			baseCurrency: null,
			baseAmount: new Prisma.Decimal("7000"),
		}),
		deal("pending-wrong-base", {
			stage: DealStage.CONTRACT_SENT,
			currency: "CHF",
			baseCurrency: "CHF",
			baseAmount: new Prisma.Decimal("9000"),
		}),
		deal("pending-variant", {
			stage: DealStage.QUALIFIED_TO_BUY,
			currency: " mxn ",
			baseAmount: null,
			baseCurrency: null,
		}),
		deal("without-price", {
			stage: DealStage.CONTRACT_SENT,
			amount: null,
			baseAmount: null,
			baseCurrency: null,
		}),
		deal("won-1000", {
			stage: DealStage.CLOSED_WON,
			closedAt: date(10, 1),
			baseAmount: new Prisma.Decimal("1000"),
		}),
		deal("won-pending", {
			stage: DealStage.CLOSED_WON,
			closedAt: date(10, 1),
			currency: "USD",
			baseAmount: null,
			baseCurrency: null,
		}),
		deal("won-previous", {
			stage: DealStage.CLOSED_WON,
			closedAt: date(9, 15),
			baseAmount: new Prisma.Decimal("400"),
		}),
		deal("lost", { stage: DealStage.CLOSED_LOST, closedAt: date(10, 1) }),
		deal("old-win", {
			stage: DealStage.CLOSED_WON,
			createdAt: date(3, 1),
			closedAt: date(4, 1),
		}),
		deal("archived-open", {
			archivedAt: date(10, 1),
			baseAmount: new Prisma.Decimal("1000000000"),
		}),
		deal("archived-win", {
			archivedAt: date(10, 1),
			stage: DealStage.CLOSED_WON,
			closedAt: date(10, 1),
		}),
		deal("archived-pending", {
			archivedAt: date(10, 1),
			baseAmount: null,
			baseCurrency: null,
		}),
		deal("other-open", {
			ownerId: OTHER,
			baseAmount: new Prisma.Decimal("300"),
		}),
		deal("other-pending", {
			ownerId: OTHER,
			currency: "CAD",
			baseAmount: null,
			baseCurrency: null,
		}),
	];
}
function activity(
	id: string,
	changes: Partial<FixtureActivity> = {},
): FixtureActivity {
	return {
		id,
		type: ActivityType.TASK,
		createdById: OWNER,
		assigneeId: OWNER,
		dealId: "open-100",
		createdAt: date(10, 1),
		dueAt: date(10, 1),
		completedAt: null,
		...changes,
	};
}
function fixtureActivities() {
	return [
		activity("active-task"),
		activity("assigned-by-other", { createdById: OTHER }),
		activity("created-for-other", { assigneeId: OTHER }),
		activity("archived-task", { dealId: "archived-open" }),
		activity("unlinked-task", { dealId: null }),
		activity("unassigned-task", { assigneeId: null }),
		activity("complete-task", { completedAt: date(10, 1) }),
		activity("future-task", { dueAt: date(10, 3) }),
		activity("other-task", { createdById: OTHER, assigneeId: OTHER }),
		activity("active-note", { type: ActivityType.NOTE, dueAt: null }),
		activity("archived-note", {
			type: ActivityType.NOTE,
			dealId: "archived-open",
			dueAt: null,
		}),
	];
}
function list<T>(value: T | T[] | undefined): T[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function matchesString(value: string | null, input: unknown): boolean {
	const filter = stringPredicate.optional().parse(input);
	if (filter === undefined) return true;
	if (filter === null || typeof filter === "string") return value === filter;
	if (filter.equals !== undefined && value !== filter.equals) return false;
	if (
		filter.in !== undefined &&
		(value === null || !filter.in?.includes(value))
	)
		return false;
	if (filter.not !== undefined) {
		if (value === null && filter.not !== null) return false;
		if (matchesString(value, filter.not)) return false;
	}
	return true;
}
function matchesDate(value: Date | null, input: unknown): boolean {
	const filter = datePredicate.optional().parse(input);
	if (filter === undefined) return true;
	if (filter === null) return value === null;
	if (filter instanceof Date || typeof filter === "string")
		return value?.getTime() === new Date(filter).getTime();
	if (filter.equals !== undefined && !matchesDate(value, filter.equals))
		return false;
	if (filter.not !== undefined && matchesDate(value, filter.not)) return false;
	if (
		filter.gte !== undefined &&
		(value === null || value < new Date(filter.gte))
	)
		return false;
	if (
		filter.lt !== undefined &&
		(value === null || value >= new Date(filter.lt))
	)
		return false;
	if (
		filter.lte !== undefined &&
		(value === null || value > new Date(filter.lte))
	)
		return false;
	return true;
}
function matchesAmount(value: Prisma.Decimal | null, input: unknown): boolean {
	const filter = amountPredicate.optional().parse(input);
	if (filter === undefined) return true;
	if (filter === null) return value === null;
	if (
		typeof filter === "number" ||
		typeof filter === "string" ||
		filter instanceof Prisma.Decimal
	)
		return value?.equals(filter) ?? false;
	return value !== null;
}
function hasActiveFilter(where: P.DealWhereInput): boolean {
	return where.archivedAt === null || list(where.AND).some(hasActiveFilter);
}
function matchesDeal(row: FixtureDeal, where: P.DealWhereInput): boolean {
	expect(
		Object.keys(where).every((key) =>
			[
				"AND",
				"OR",
				"NOT",
				"ownerId",
				"stage",
				"archivedAt",
				"createdAt",
				"closedAt",
				"expectedCloseDate",
				"baseCurrency",
				"baseAmount",
				"amount",
			].includes(key),
		),
	).toBe(true);
	if (!list(where.AND).every((part) => matchesDeal(row, part))) return false;
	if (where.OR && !where.OR.some((part) => matchesDeal(row, part)))
		return false;
	if (list(where.NOT).some((part) => matchesDeal(row, part))) return false;
	return (
		matchesString(row.ownerId, where.ownerId) &&
		matchesString(row.stage, where.stage) &&
		matchesString(row.baseCurrency, where.baseCurrency) &&
		matchesAmount(row.amount, where.amount) &&
		matchesAmount(row.baseAmount, where.baseAmount) &&
		matchesDate(row.archivedAt, where.archivedAt) &&
		matchesDate(row.createdAt, where.createdAt) &&
		matchesDate(row.closedAt, where.closedAt) &&
		matchesDate(row.expectedCloseDate, where.expectedCloseDate)
	);
}
function matchesActivity(
	row: FixtureActivity,
	where: P.ActivityWhereInput,
	deals: FixtureDeal[],
): boolean {
	expect(
		Object.keys(where).every((key) =>
			[
				"AND",
				"OR",
				"type",
				"dealId",
				"deal",
				"createdById",
				"assigneeId",
				"completedAt",
				"dueAt",
			].includes(key),
		),
	).toBe(true);
	if (!list(where.AND).every((part) => matchesActivity(row, part, deals)))
		return false;
	if (where.OR && !where.OR.some((part) => matchesActivity(row, part, deals)))
		return false;
	if (where.deal) {
		expect(where.deal).toEqual({ is: { archivedAt: null } });
		const linked = deals.find((candidate) => candidate.id === row.dealId);
		if (!linked || linked.archivedAt !== null) return false;
	}
	return (
		matchesString(row.dealId, where.dealId) &&
		matchesString(row.type, where.type) &&
		matchesString(row.createdById, where.createdById) &&
		matchesString(row.assigneeId, where.assigneeId) &&
		matchesDate(row.completedAt, where.completedAt) &&
		matchesDate(row.dueAt, where.dueAt)
	);
}
function sum(rows: FixtureDeal[]) {
	const amounts = rows.flatMap((row) =>
		row.baseAmount === null ? [] : [row.baseAmount],
	);
	return amounts.length === 0 ? null : Prisma.Decimal.sum(...amounts);
}
function compare(
	a: Date | Prisma.Decimal | string | null,
	b: Date | Prisma.Decimal | string | null,
) {
	if (a === null) return b === null ? 0 : 1;
	if (b === null) return -1;
	if (Prisma.Decimal.isDecimal(a) && Prisma.Decimal.isDecimal(b))
		return a.comparedTo(b);
	const left = a instanceof Date ? a.getTime() : a.toString();
	const right = b instanceof Date ? b.getTime() : b.toString();
	return left === right ? 0 : left < right ? -1 : 1;
}
function sortDeals(rows: FixtureDeal[], input: P.DealFindManyArgs) {
	return [...rows].sort((a, b) => {
		for (const order of list(input.orderBy)) {
			const key = Object.keys(order)[0] ?? "";
			expect(["baseAmount", "expectedCloseDate", "id"]).toContain(key);
			const field = key as "baseAmount" | "expectedCloseDate" | "id";
			const setting = order[field];
			const direction = typeof setting === "string" ? setting : setting?.sort;
			const result = compare(a[field], b[field]);
			if (result !== 0) {
				if (a[field] === null || b[field] === null) return result;
				return direction === "desc" ? -result : result;
			}
		}
		return 0;
	});
}
function harness(
	deals = fixtureDeals(),
	activities = fixtureActivities(),
	base = "MXN",
) {
	const reads: Read[] = [];
	const owner = (id: string) => ({
		id,
		name: id,
		email: `${id}@example.test`,
		image: null,
	});
	const company = {
		id: "company-synthetic",
		name: "Synthetic Company",
		iconUrl: null,
		iconDarkUrl: null,
		iconTone: null,
	};
	function selected(
		where: P.DealWhereInput | undefined,
		operation: Read["operation"],
	) {
		expect(where).toBeDefined();
		expect(hasActiveFilter(where ?? {})).toBe(true);
		const rows = deals.filter((row) => matchesDeal(row, where ?? {}));
		reads.push({ model: "deal", operation, ids: rows.map((row) => row.id) });
		return rows;
	}
	const groupBy = mock(async (input: P.DealGroupByArgs) => {
		const rows = selected(input.where, "groupBy");
		const key = list(input.by)[0] ?? "";
		expect(["stage", "currency"]).toContain(key);
		if (input._sum) expect(input._sum).toEqual({ baseAmount: true });
		const field = key as "stage" | "currency";
		const groups = new Map<string, FixtureDeal[]>();
		for (const row of rows)
			groups.set(row[field], [...(groups.get(row[field]) ?? []), row]);
		return [...groups].map(([value, group]) => ({
			[field]: value,
			_count: { _all: group.length },
			_sum: { baseAmount: sum(group) },
		}));
	});
	const aggregate = mock(async (input: P.DealAggregateArgs) => {
		expect(input._sum).toEqual({ baseAmount: true });
		expect(input._count).toBeUndefined();
		return { _sum: { baseAmount: sum(selected(input.where, "aggregate")) } };
	});
	const count = mock(
		async (input: P.DealCountArgs) => selected(input.where, "count").length,
	);
	const findMany = mock(async (input: P.DealFindManyArgs) => {
		const rows = sortDeals(selected(input.where, "findMany"), input);
		const limited = input.take === undefined ? rows : rows.slice(0, input.take);
		return limited.map((row) =>
			input.select?.id
				? {
						id: row.id,
						name: row.name,
						stage: row.stage,
						amount: row.amount,
						currency: row.currency,
						baseAmount: row.baseAmount,
						baseCurrency: row.baseCurrency,
						expectedCloseDate: row.expectedCloseDate,
						stageChangedAt: row.stageChangedAt,
						company,
						owner: owner(row.ownerId),
					}
				: {
						baseAmount: row.baseAmount,
						baseCurrency: row.baseCurrency,
						stage: row.stage,
						createdAt: row.createdAt,
						closedAt: row.closedAt,
					},
		);
	});
	const activityFindMany = mock(async (input: P.ActivityFindManyArgs) => {
		const where = input.where ?? {};
		expect(list(where.AND)).toContainEqual({
			OR: [{ dealId: null }, { deal: { is: { archivedAt: null } } }],
		});
		const rows = activities.filter((row) => matchesActivity(row, where, deals));
		reads.push({
			model: "activity",
			operation: "findMany",
			ids: rows.map((row) => row.id),
		});
		const order = list(input.orderBy)[0];
		rows.sort((a, b) =>
			order?.dueAt
				? compare(a.dueAt, b.dueAt)
				: compare(b.createdAt, a.createdAt),
		);
		return rows.slice(0, input.take).map((row) => {
			const linked = deals.find((candidate) => candidate.id === row.dealId);
			const linkedDeal = linked ? { id: linked.id, name: linked.name } : null;
			const linkedCompany = { id: company.id, name: company.name };
			return input.select?.dueAt
				? {
						id: row.id,
						subject: row.id,
						dueAt: row.dueAt,
						company: linkedCompany,
						deal: linkedDeal,
					}
				: {
						id: row.id,
						type: row.type,
						subject: row.id,
						body: null,
						createdAt: row.createdAt,
						meta: null,
						createdBy: owner(row.createdById),
						company: linkedCompany,
						deal: linkedDeal,
					};
		});
	});
	const settings = mock(async () => ({ reportingCurrency: base }));
	const db = {
		deal: { groupBy, aggregate, count, findMany },
		activity: { findMany: activityFindMany },
		appSetting: { findUnique: settings },
	} as unknown as Db;
	const service = new DashboardService(db, new ConversionService(db));
	return {
		service,
		deals,
		activities,
		reads,
		groupBy,
		aggregate,
		count,
		findMany,
		activityFindMany,
		settings,
	};
}

beforeEach(() => {
	setSystemTime(NOW);
	network.mockClear();
});
afterEach(() => {
	expect(network).not.toHaveBeenCalled();
	setSystemTime();
});
afterAll(() => network.mockRestore());

describe("dashboard archive and money population", () => {
	it("counts active opportunities independently from their converted values", async () => {
		const fake = harness();
		const output = await fake.service.summary(OWNER, { scope: "me" });
		expect(output.reportingCurrency).toBe("MXN");
		expect(output.pipeline.totalDeals).toBe(8);
		expect(output.pipeline.totalCents).toBe(30_000);
		expect(output.pipeline.stages).toEqual([
			{ stage: DealStage.DEMO_BOOKED, count: 2, valueCents: 10_000 },
			{ stage: DealStage.QUALIFIED_TO_BUY, count: 2, valueCents: 20_000 },
			{ stage: DealStage.DECISION_MAKER_BOUGHT_IN, count: 1, valueCents: 0 },
			{ stage: DealStage.CONTRACT_SENT, count: 3, valueCents: 0 },
		]);
		expect(output.closingThisMonthTotal).toEqual({
			count: 8,
			valueCents: 30_000,
		});
		expect(fake.count).toHaveBeenCalledTimes(1);
		expect(dashboardSummaryOutput.safeParse(output).success).toBe(true);
	});
	it("discloses null and stale bases without treating absent prices as missing rates", async () => {
		const fake = harness();
		const output = await fake.service.summary(OWNER, { scope: "me" });
		expect(output.unconverted).toEqual({
			count: 5,
			currencies: ["CHF", "MXN", "USD"],
		});
		expect(fake.settings).toHaveBeenCalledTimes(1);
	});
	it("keeps win counts and win rate separate from the valued-win average", async () => {
		const output = await harness().service.summary(OWNER, { scope: "me" });
		expect(output.wonThisMonth).toEqual({ count: 2, valueCents: 100_000 });
		expect(output.wonPrevMonth).toEqual({ count: 1, valueCents: 40_000 });
		expect(output.performance).toEqual({
			windowDays: 90,
			wins: 3,
			losses: 1,
			winRate: 0.75,
			avgDealCents: 70_000,
			avgCycleDays: 16,
		});
		expect(output.trend.map((point) => point.won)).toEqual([
			0, 0, 0, 0, 40_000, 100_000,
		]);
		expect(output.trend.map((point) => point.created)).toEqual([
			0, 0, 0, 0, 180_000, 0,
		]);
	});
	it("applies active-row filters to every group, count, aggregate and list", async () => {
		const fake = harness();
		await fake.service.summary(OWNER, { scope: "me" });
		expect(fake.groupBy).toHaveBeenCalledTimes(3);
		expect(fake.aggregate).toHaveBeenCalledTimes(1);
		expect(fake.count).toHaveBeenCalledTimes(1);
		expect(fake.findMany).toHaveBeenCalledTimes(3);
		expect(fake.activityFindMany).toHaveBeenCalledTimes(2);
		expect(fake.reads).toHaveLength(10);
		for (const read of fake.reads) {
			expect(read.ids.some((id) => id.startsWith("archived-"))).toBe(false);
			if (read.model === "deal")
				expect(read.ids.some((id) => id.startsWith("other-"))).toBe(false);
		}
	});
	it("changes ownership scope without mixing archived opportunities or bases", async () => {
		const output = await harness().service.summary(OWNER, {
			scope: "everyone",
		});
		expect(output.pipeline.totalDeals).toBe(10);
		expect(output.pipeline.totalCents).toBe(60_000);
		expect(output.closingThisMonthTotal).toEqual({
			count: 10,
			valueCents: 60_000,
		});
		expect(output.unconverted).toEqual({
			count: 6,
			currencies: ["CAD", "CHF", "MXN", "USD"],
		});
		expect(output.biggestOpen[0]?.id).toBe("other-open");
	});
	it("archive and restore change reports without changing stored money", async () => {
		const fake = harness();
		const before = await fake.service.summary(OWNER, { scope: "me" });
		const target = fake.deals.find((row) => row.id === "open-100");
		if (!target) throw new Error("Missing synthetic opportunity");
		const original = { ...target };
		target.archivedAt = NOW;
		const archived = await fake.service.summary(OWNER, { scope: "me" });
		expect(archived.pipeline.totalDeals).toBe(7);
		expect(archived.pipeline.totalCents).toBe(20_000);
		expect(archived.closingThisMonthTotal).toEqual({
			count: 7,
			valueCents: 20_000,
		});
		expect(archived.biggestOpen.some((row) => row.id === target.id)).toBe(
			false,
		);
		expect(
			archived.overdueTasks.some((row) => row.deal?.id === target.id),
		).toBe(false);
		expect(
			archived.recentActivity.some((row) => row.deal?.id === target.id),
		).toBe(false);
		expect(archived.trend[4]?.created).toBe(170_000);
		target.archivedAt = null;
		expect(target).toEqual(original);
		expect(await fake.service.summary(OWNER, { scope: "me" })).toEqual(before);
	});
	it("archiving an unconverted win removes its count and disclosure without reducing money", async () => {
		const fake = harness();
		const target = fake.deals.find((row) => row.id === "won-pending");
		if (!target) throw new Error("Missing synthetic win");
		target.archivedAt = NOW;
		const output = await fake.service.summary(OWNER, { scope: "me" });
		expect(output.wonThisMonth).toEqual({ count: 1, valueCents: 100_000 });
		expect(output.performance.wins).toBe(2);
		expect(output.performance.avgDealCents).toBe(70_000);
		expect(output.unconverted).toEqual({
			count: 4,
			currencies: ["CHF", "MXN"],
		});
		target.archivedAt = null;
		const restored = await fake.service.summary(OWNER, { scope: "me" });
		expect(restored.wonThisMonth.count).toBe(2);
		expect(restored.unconverted.count).toBe(5);
	});
	it("reports an empty population explicitly without inventing averages", async () => {
		const output = await harness([], []).service.summary(OWNER, {
			scope: "me",
		});
		expect(output.pipeline.totalDeals).toBe(0);
		expect(output.pipeline.totalCents).toBe(0);
		expect(output.closingThisMonthTotal).toEqual({ count: 0, valueCents: 0 });
		expect(output.unconverted).toEqual({ count: 0, currencies: [] });
		expect(output.performance.winRate).toBeNull();
		expect(output.performance.avgDealCents).toBeNull();
		expect(output.performance.avgCycleDays).toBeNull();
		expect(output.biggestOpen).toEqual([]);
		expect(
			output.trend.every((point) => point.won === 0 && point.created === 0),
		).toBe(true);
	});
	it("counts an all-unconverted population but does not average it as zero money", async () => {
		const rows = [
			deal("only-pending-open", { baseAmount: null, baseCurrency: null }),
			deal("only-pending-win", {
				stage: DealStage.CLOSED_WON,
				closedAt: date(10, 1),
				baseAmount: null,
				baseCurrency: null,
			}),
		];
		const output = await harness(rows, []).service.summary(OWNER, {
			scope: "me",
		});
		expect(output.pipeline.totalDeals).toBe(1);
		expect(output.pipeline.totalCents).toBe(0);
		expect(output.closingThisMonthTotal).toEqual({ count: 1, valueCents: 0 });
		expect(output.wonThisMonth).toEqual({ count: 1, valueCents: 0 });
		expect(output.performance.avgDealCents).toBeNull();
		expect(output.performance.winRate).toBe(1);
		expect(output.unconverted).toEqual({ count: 2, currencies: ["MXN"] });
		expect(output.biggestOpen[0]?.baseAmountCents).toBeNull();
	});
	it("uses the explicit reporting setting instead of selecting MXN for the company", async () => {
		const output = await harness(fixtureDeals(), [], "USD").service.summary(
			OWNER,
			{ scope: "me" },
		);
		expect(output.reportingCurrency).toBe("USD");
		expect(output.pipeline.totalDeals).toBe(8);
		expect(output.pipeline.totalCents).toBe(0);
		expect(output.unconverted.count).toBe(12);
	});
	it("groups custom open stages by unchanged legacy classification and excludes disqualified outcomes", async () => {
		const rows = [
			deal("custom-open-a", { pipelineStageId: "stage-synthetic-a" }),
			deal("custom-open-b", { pipelineStageId: "stage-synthetic-b" }),
			deal("custom-won", {
				pipelineStageId: "stage-synthetic-won",
				stage: DealStage.CLOSED_WON,
				closedAt: date(10, 1),
			}),
			deal("custom-lost", {
				pipelineStageId: "stage-synthetic-lost",
				stage: DealStage.CLOSED_LOST,
				closedAt: date(10, 1),
			}),
			deal("custom-disqualified", {
				pipelineStageId: "stage-synthetic-disqualified",
				stage: DealStage.UNQUALIFIED_TO_BUY,
				closedAt: date(10, 1),
			}),
		];
		const output = await harness(rows, []).service.summary(OWNER, {
			scope: "me",
		});
		expect(output.pipeline.totalDeals).toBe(2);
		expect(output.pipeline.totalCents).toBe(20_000);
		expect(output.pipeline.stages[0]).toEqual({
			stage: DealStage.DEMO_BOOKED,
			count: 2,
			valueCents: 20_000,
		});
		expect(output.performance.wins).toBe(1);
		expect(output.performance.losses).toBe(1);
		expect(output.performance.winRate).toBe(0.5);
	});
	it("adds converted decimal values instead of original mixed-currency amounts", async () => {
		const output = await harness(
			[
				deal("decimal-a", {
					amount: new Prisma.Decimal("999"),
					currency: "USD",
					baseAmount: new Prisma.Decimal("10.01"),
				}),
				deal("decimal-b", {
					amount: new Prisma.Decimal("777"),
					currency: "EUR",
					baseAmount: new Prisma.Decimal("20.02"),
				}),
			],
			[],
		).service.summary(OWNER, { scope: "me" });
		expect(output.pipeline.totalCents).toBe(3003);
		expect(output.closingThisMonthTotal.valueCents).toBe(3003);
	});
});

describe("largest opportunities and reporting dates", () => {
	it("ranks current-base values before unknown values, including measured zero", async () => {
		const output = await harness().service.summary(OWNER, { scope: "me" });
		expect(output.biggestOpen).toHaveLength(6);
		expect(
			output.biggestOpen
				.slice(0, 3)
				.map((row) => [row.id, row.baseAmountCents]),
		).toEqual([
			["open-200", 20_000],
			["open-100", 10_000],
			["open-zero", 0],
		]);
		expect(
			output.biggestOpen.slice(3).every((row) => row.baseAmountCents === null),
		).toBe(true);
	});
	it("filters stale high values before the database limit selects the top six", async () => {
		const rows = [
			...Array.from({ length: 8 }, (_, index) =>
				deal(`valid-${index}`, { baseAmount: new Prisma.Decimal(index + 1) }),
			),
			...Array.from({ length: 8 }, (_, index) =>
				deal(`stale-${index}`, {
					baseAmount: new Prisma.Decimal(1_000_000 + index),
					baseCurrency: "JPY",
				}),
			),
		];
		const output = await harness(rows, []).service.summary(OWNER, {
			scope: "me",
		});
		expect(output.biggestOpen.map((row) => row.id)).toEqual([
			"valid-7",
			"valid-6",
			"valid-5",
			"valid-4",
			"valid-3",
			"valid-2",
		]);
	});
	it("uses stable record IDs to break equal-value and equal-date ties", async () => {
		const output = await harness([deal("b"), deal("a")], []).service.summary(
			OWNER,
			{ scope: "me" },
		);
		expect(output.biggestOpen.map((row) => row.id)).toEqual(["a", "b"]);
	});
	it("includes the month start and excludes the next month from expected closes", async () => {
		const begin = new Date(2026, 9, 1);
		const rows = [
			deal("begin", { expectedCloseDate: begin }),
			deal("before", { expectedCloseDate: new Date(begin.getTime() - 1) }),
			deal("after", { expectedCloseDate: new Date(2026, 10, 1) }),
			deal("missing-date", { expectedCloseDate: null }),
		];
		const output = await harness(rows, []).service.summary(OWNER, {
			scope: "me",
		});
		expect(output.pipeline.totalDeals).toBe(4);
		expect(output.closingThisMonthTotal).toEqual({
			count: 1,
			valueCents: 10_000,
		});
	});
	it("includes the 90-day boundary and excludes future and earlier decisions", async () => {
		const boundary = new Date(NOW.getTime() - 90 * DAY_MS);
		const rows = [
			deal("boundary-win", {
				stage: DealStage.CLOSED_WON,
				createdAt: new Date(boundary.getTime() - DAY_MS),
				closedAt: boundary,
			}),
			deal("before-win", {
				stage: DealStage.CLOSED_WON,
				createdAt: new Date(boundary.getTime() - DAY_MS),
				closedAt: new Date(boundary.getTime() - 1),
			}),
			deal("future-win", {
				stage: DealStage.CLOSED_WON,
				closedAt: new Date(NOW.getTime() + 1),
			}),
			deal("now-loss", { stage: DealStage.CLOSED_LOST, closedAt: NOW }),
		];
		const output = await harness(rows, []).service.summary(OWNER, {
			scope: "me",
		});
		expect(output.performance.wins).toBe(1);
		expect(output.performance.losses).toBe(1);
		expect(output.performance.winRate).toBe(0.5);
		expect(output.wonThisMonth.count).toBe(0);
		expect(output.trend[5]?.won).toBe(0);
	});
	it("does not put a future creation into the current trend", async () => {
		const output = await harness(
			[deal("future-created", { createdAt: new Date(NOW.getTime() + 1) })],
			[],
		).service.summary(OWNER, { scope: "me" });
		expect(output.trend.every((point) => point.created === 0)).toBe(true);
	});
});

describe("assigned overdue tasks and archived opportunity activity", () => {
	it("includes tasks assigned by another person and excludes tasks assigned elsewhere", async () => {
		const fake = harness();
		const output = await fake.service.summary(OWNER, { scope: "me" });
		expect(output.overdueTasks.map((row) => row.id)).toEqual([
			"active-task",
			"assigned-by-other",
			"unlinked-task",
		]);
		const query = fake.activityFindMany.mock.calls[0]?.[0];
		expect(list(query?.where?.AND)).toContainEqual({
			type: ActivityType.TASK,
			completedAt: null,
			dueAt: { lt: NOW },
			assigneeId: OWNER,
		});
	});
	it("everyone includes other and unassigned overdue tasks, but not archived or complete tasks", async () => {
		const output = await harness().service.summary(OWNER, {
			scope: "everyone",
		});
		expect(output.overdueTasks.map((row) => row.id)).toEqual([
			"active-task",
			"assigned-by-other",
			"created-for-other",
			"unlinked-task",
			"unassigned-task",
			"other-task",
		]);
	});
	it("keeps recent activity scoped by author and retains unlinked history", async () => {
		const fake = harness();
		const mine = await fake.service.summary(OWNER, { scope: "me" });
		expect(mine.recentActivity.some((row) => row.id === "unlinked-task")).toBe(
			true,
		);
		expect(mine.recentActivity.some((row) => row.id === "active-note")).toBe(
			true,
		);
		expect(
			mine.recentActivity.some((row) => row.id === "assigned-by-other"),
		).toBe(false);
		expect(
			mine.recentActivity.some((row) => row.id.startsWith("archived-")),
		).toBe(false);
		const all = await fake.service.summary(OWNER, { scope: "everyone" });
		expect(
			all.recentActivity.some((row) => row.id === "assigned-by-other"),
		).toBe(true);
		expect(
			all.recentActivity.some((row) => row.id.startsWith("archived-")),
		).toBe(false);
	});
});
