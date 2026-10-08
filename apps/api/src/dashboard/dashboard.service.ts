import { ActivityType, type Db, DealStage, type Prisma } from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import { OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import { activityMeta } from "@crm/validation/activity-meta";
import { Injectable } from "@nestjs/common";
import { toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { archivedFilter } from "../trpc/list-input";
import type { DashboardSummaryInput } from "./dashboard.contracts";
import { DASHBOARD } from "./dashboard-config";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short" });

function monthStart(from: Date, offset: number): Date {
	return new Date(from.getFullYear(), from.getMonth() + offset, 1);
}

function monthKey(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

@Injectable()
export class DashboardService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async summary(actingUserId: string, input: DashboardSummaryInput) {
		const mine = input.scope === "me";
		const owned = mine ? { ownerId: actingUserId } : {};
		const active = { ...owned, ...archivedFilter(false) };
		const open = { ...active, stage: { in: [...OPEN_DEAL_STAGES] } };
		const activeActivity: Prisma.ActivityWhereInput = {
			OR: [{ dealId: null }, { deal: { is: archivedFilter(false) } }],
		};

		const now = new Date();
		const startOfMonth = monthStart(now, 0);
		const startOfNextMonth = monthStart(now, 1);
		const startOfPrevMonth = monthStart(now, -1);
		const trendStart = monthStart(now, -(DASHBOARD.trendMonths - 1));
		const rateStart = new Date(
			now.getTime() - DASHBOARD.rateWindowDays * DASHBOARD.dayMs,
		);
		const closingThisMonth = {
			...open,
			expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
		};

		const base = await this.conversion.reportingCurrency();
		const counted = this.conversion.countedWhere(base);
		const unvalued: Prisma.DealWhereInput = {
			OR: [
				{ baseAmount: null },
				{ baseCurrency: null },
				{ baseCurrency: { not: base } },
			],
		};
		const biggestSelect = {
			id: true,
			name: true,
			stage: true,
			amount: true,
			currency: true,
			baseAmount: true,
			baseCurrency: true,
			expectedCloseDate: true,
			stageChangedAt: true,
			company: {
				select: {
					id: true,
					name: true,
					iconUrl: true,
					iconDarkUrl: true,
					iconTone: true,
				},
			},
			owner: { select: OWNER_SELECT },
		} as const;

		const [
			openByStage,
			openValueByStage,
			recentDeals,
			closingThisMonthTotals,
			closingThisMonthCount,
			biggestOpen,
			unvaluedOpen,
			overdueTasks,
			recentActivity,
			pendingByCurrency,
		] = await Promise.all([
			this.db.deal.groupBy({
				by: ["stage"],
				where: open,
				_count: { _all: true },
			}),
			this.db.deal.groupBy({
				by: ["stage"],
				where: {
					AND: [open, counted],
				},
				_sum: { baseAmount: true },
			}),
			this.db.deal.findMany({
				where: {
					...active,
					OR: [
						{ createdAt: { gte: trendStart, lte: now } },
						{ closedAt: { gte: trendStart, lte: now } },
					],
				},
				select: {
					baseAmount: true,
					baseCurrency: true,
					stage: true,
					createdAt: true,
					closedAt: true,
				},
			}),
			this.db.deal.aggregate({
				where: {
					AND: [closingThisMonth, counted],
				},
				_sum: { baseAmount: true },
			}),
			this.db.deal.count({ where: closingThisMonth }),
			this.db.deal.findMany({
				where: { AND: [open, counted] },
				orderBy: [
					{ baseAmount: { sort: "desc", nulls: "last" } },
					{ expectedCloseDate: { sort: "asc", nulls: "last" } },
					{ id: "asc" },
				],
				take: DASHBOARD.largestDeals,
				select: biggestSelect,
			}),
			this.db.deal.findMany({
				where: { AND: [open, unvalued] },
				orderBy: [
					{ expectedCloseDate: { sort: "asc", nulls: "last" } },
					{ id: "asc" },
				],
				take: DASHBOARD.largestDeals,
				select: biggestSelect,
			}),
			this.db.activity.findMany({
				where: {
					AND: [
						activeActivity,
						{
							type: ActivityType.TASK,
							completedAt: null,
							dueAt: { lt: now },
							...(mine ? { assigneeId: actingUserId } : {}),
						},
					],
				},
				orderBy: [{ dueAt: "asc" }],
				take: DASHBOARD.overdueTasks,
				select: {
					id: true,
					subject: true,
					dueAt: true,
					company: { select: { id: true, name: true } },
					deal: { select: { id: true, name: true } },
				},
			}),
			this.db.activity.findMany({
				where: {
					AND: [activeActivity, mine ? { createdById: actingUserId } : {}],
				},
				orderBy: [{ createdAt: "desc" }],
				take: DASHBOARD.recentActivities,
				select: {
					id: true,
					type: true,
					subject: true,
					body: true,
					createdAt: true,
					meta: true,
					createdBy: { select: OWNER_SELECT },
					company: { select: { id: true, name: true } },
					deal: { select: { id: true, name: true } },
				},
			}),
			this.db.deal.groupBy({
				by: ["currency"],
				where: { AND: [active, this.conversion.pendingWhere(base)] },
				_count: { _all: true },
			}),
		]);

		const stages = OPEN_DEAL_STAGES.map((stage) => {
			const group = openByStage.find((row) => row.stage === stage);
			const value = openValueByStage.find((row) => row.stage === stage);
			return {
				stage: stage as DealStage,
				count: group?._count._all ?? 0,
				valueCents: toCents(value?._sum.baseAmount ?? null) ?? 0,
			};
		});

		const firstBucket = monthKey(trendStart);
		const trend = Array.from({ length: DASHBOARD.trendMonths }, (_, index) => ({
			month: MONTH_LABEL.format(monthStart(trendStart, index)),
			won: 0,
			created: 0,
		}));

		const wonThisMonth = { count: 0, valueCents: 0 };
		const wonPrevMonth = { count: 0, valueCents: 0 };
		let wins = 0;
		let losses = 0;
		let valuedWins = 0;
		let wonCents = 0;
		let cycleDays = 0;

		for (const deal of recentDeals) {
			const valued =
				deal.baseCurrency === base ? toCents(deal.baseAmount) : null;
			const cents = valued ?? 0;

			const created = trend[monthKey(deal.createdAt) - firstBucket];
			if (created && deal.createdAt <= now) created.created += cents;

			const { closedAt, stage } = deal;
			if (!closedAt || closedAt > now) continue;
			const won = stage === DealStage.CLOSED_WON;

			if (won) {
				const closed = trend[monthKey(closedAt) - firstBucket];
				if (closed) closed.won += cents;

				if (closedAt >= startOfMonth && closedAt < startOfNextMonth) {
					wonThisMonth.count += 1;
					wonThisMonth.valueCents += cents;
				} else if (closedAt >= startOfPrevMonth && closedAt < startOfMonth) {
					wonPrevMonth.count += 1;
					wonPrevMonth.valueCents += cents;
				}
			}

			if (closedAt < rateStart) continue;
			if (won) {
				wins += 1;
				if (valued !== null) {
					valuedWins += 1;
					wonCents += cents;
				}
				cycleDays +=
					(closedAt.getTime() - deal.createdAt.getTime()) / DASHBOARD.dayMs;
			} else if (stage === DealStage.CLOSED_LOST) {
				losses += 1;
			}
		}

		const decided = wins + losses;

		return {
			scope: input.scope,
			reportingCurrency: base,
			unconverted: {
				count: pendingByCurrency.reduce(
					(total, row) => total + row._count._all,
					0,
				),
				currencies: [
					...new Set(
						pendingByCurrency.map((row) => normalizeCurrency(row.currency)),
					),
				].sort(),
			},
			pipeline: {
				stages,
				totalCents: stages.reduce((total, s) => total + s.valueCents, 0),
				totalDeals: stages.reduce((total, s) => total + s.count, 0),
			},
			wonThisMonth,
			wonPrevMonth,
			performance: {
				windowDays: DASHBOARD.rateWindowDays,
				wins,
				losses,
				winRate: decided === 0 ? null : wins / decided,
				avgDealCents:
					valuedWins === 0 ? null : Math.round(wonCents / valuedWins),
				avgCycleDays: wins === 0 ? null : Math.round(cycleDays / wins),
			},
			trend,
			closingThisMonthTotal: {
				count: closingThisMonthCount,
				valueCents: toCents(closingThisMonthTotals._sum.baseAmount) ?? 0,
			},
			biggestOpen: [...biggestOpen, ...unvaluedOpen]
				.slice(0, DASHBOARD.largestDeals)
				.map(
					({
						amount,
						baseAmount,
						baseCurrency,
						expectedCloseDate,
						stageChangedAt,
						...deal
					}) => ({
						...deal,
						amountCents: toCents(amount),
						baseAmountCents: baseCurrency === base ? toCents(baseAmount) : null,
						expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
						stageChangedAt: stageChangedAt.toISOString(),
					}),
				),
			overdueTasks: overdueTasks.map(({ dueAt, ...task }) => ({
				...task,
				dueAt: dueAt?.toISOString() ?? null,
			})),
			recentActivity: recentActivity.map(({ createdAt, meta, ...entry }) => ({
				...entry,
				createdAt: createdAt.toISOString(),
				meta: activityMeta.parse(meta),
			})),
		};
	}
}
