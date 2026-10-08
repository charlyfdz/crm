import { ActivityType, type Db, type Prisma } from "@crm/db";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { activityMeta } from "@crm/validation/activity-meta";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { ActivityStampService } from "../crm/activity-stamp.service";
import { blankToNull } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import type {
	ActivityCreateInput,
	ActivityEntry,
	MyTasksInput,
	TaskUpdateInput,
	TimelineCounts,
	TimelineFilter,
	TimelineInput,
	TimelineResult,
} from "./activities.contracts";
import {
	activityCreateInput,
	completeInput,
	myTasksInput,
	taskUpdateInput,
} from "./activities.contracts";

const AUTHOR_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const ENTRY_SELECT = {
	id: true,
	type: true,
	subject: true,
	body: true,
	occurredAt: true,
	dueAt: true,
	completedAt: true,
	meta: true,
	createdAt: true,
	createdBy: { select: AUTHOR_SELECT },
	assignee: { select: AUTHOR_SELECT },
	priority: true,
	company: { select: { id: true, name: true } },
	contact: { select: { id: true, firstName: true, lastName: true } },
	deal: { select: { id: true, name: true } },

	emailThread: {
		select: {
			id: true,
			messageCount: true,
			lastMessageAt: true,
		},
	},
	calendarEvent: {
		select: {
			id: true,
			startsAt: true,
			endsAt: true,
			isAllDay: true,
			location: true,
			conferenceUrl: true,
			_count: { select: { attendees: true } },
		},
	},
} as const;

const NOTE_TYPES = [
	ActivityType.NOTE,
	ActivityType.CALL,
	ActivityType.EMAIL,
	ActivityType.MEETING,
];

@Injectable()
export class ActivitiesService {
	private readonly logger = new Logger(ActivitiesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
	) {}

	async timeline(
		input: TimelineInput,
		actingUserId: string,
	): Promise<TimelineResult> {
		await this.readMember(actingUserId);
		const where = this.anchor(input);
		Object.assign(where, filterClause(input.filter));

		const rows = await this.db.activity.findMany({
			where,
			take: input.limit + 1,
			cursor: input.cursor ? { id: input.cursor } : undefined,
			skip: input.cursor ? 1 : undefined,
			orderBy: [
				{ occurredAt: { sort: "desc", nulls: "last" } },
				{ id: "desc" },
			],
			select: ENTRY_SELECT,
		});

		const hasMore = rows.length > input.limit;
		const entries = hasMore ? rows.slice(0, input.limit) : rows;

		return {
			entries: entries.map(serializeEntry),
			nextCursor: hasMore ? (entries[entries.length - 1]?.id ?? null) : null,
		};
	}

	async timelineCounts(
		input: Pick<TimelineInput, "companyId" | "contactId" | "dealId">,
		actingUserId: string,
	): Promise<TimelineCounts> {
		await this.readMember(actingUserId);
		const anchor = this.anchor(input);

		const [all, notes, upcoming, done, email, meetings] = await Promise.all([
			this.db.activity.count({ where: anchor }),
			this.db.activity.count({
				where: { ...anchor, ...filterClause("notes") },
			}),
			this.db.activity.count({
				where: { ...anchor, ...filterClause("upcoming") },
			}),
			this.db.activity.count({ where: { ...anchor, ...filterClause("done") } }),
			this.db.activity.count({
				where: { ...anchor, ...filterClause("email") },
			}),
			this.db.activity.count({
				where: { ...anchor, ...filterClause("meetings") },
			}),
		]);

		return { all, notes, upcoming, done, email, meetings };
	}

	async create(
		input: ActivityCreateInput,
		actingUserId: string,
	): Promise<ActivityEntry> {
		input = validate(activityCreateInput, input);
		const activity = await this.mutate(async (tx) => {
			const role = await this.lockMember(tx, actingUserId);
			const isTask = input.type === ActivityType.TASK;
			const assigneeId = isTask ? (input.assigneeId ?? actingUserId) : null;
			if (assigneeId && assigneeId !== actingUserId) {
				this.assertAssignmentRole(role);
				await this.lockMember(tx, assigneeId);
			}
			const companyId = await this.resolveRelations(tx, input);
			return tx.activity.create({
				data: {
					type: input.type,
					subject: blankToNull(input.subject ?? ""),
					body: blankToNull(input.body ?? ""),
					occurredAt: parseDate(input.occurredAt) ?? new Date(),
					dueAt: isTask ? parseDate(input.dueAt) : null,
					assigneeId,
					priority: isTask ? (input.priority ?? 0) : 0,
					companyId,
					contactId: input.contactId ?? null,
					dealId: input.dealId ?? null,
					createdById: actingUserId,
				},
				select: ENTRY_SELECT,
			});
		});

		try {
			await this.stamp.touch(
				{
					companyId: activity.company?.id,
					contactId: input.contactId,
					dealId: input.dealId,
				},
				activity.createdAt,
			);
		} catch (error) {
			this.logger.error(
				{
					message: "Activity saved but activity stamps need repair",
					activityId: activity.id,
				},
				error instanceof Error ? error.stack : String(error),
			);
		}

		this.logger.log({
			message: "Activity logged",
			activityId: activity.id,
			type: activity.type,
		});

		return serializeEntry(activity);
	}

	async complete(
		id: string,
		completed: boolean,
		actingUserId: string,
	): Promise<ActivityEntry> {
		const input = validate(completeInput, { id, completed });
		const updated = await this.mutate(async (tx) => {
			const role = await this.lockMember(tx, actingUserId);
			const activity = await this.lockTask(tx, input.id);
			this.assertTaskActor(activity, actingUserId, role);
			await this.resolveRelations(tx, activity);
			return tx.activity.update({
				where: { id: input.id },
				data: {
					completedAt: input.completed
						? (activity.completedAt ?? new Date())
						: null,
				},
				select: ENTRY_SELECT,
			});
		});
		return serializeEntry(updated);
	}

	async updateTask(
		input: TaskUpdateInput,
		actingUserId: string,
	): Promise<ActivityEntry> {
		input = validate(taskUpdateInput, input);
		const updated = await this.mutate(async (tx) => {
			const role = await this.lockMember(tx, actingUserId);
			const activity = await this.lockTask(tx, input.id);
			this.assertTaskActor(activity, actingUserId, role);
			if (input.assigneeId !== undefined) {
				if (input.assigneeId !== activity.assigneeId)
					this.assertAssignmentRole(role);
				await this.lockMember(tx, input.assigneeId);
			}
			await this.resolveRelations(tx, activity);
			return tx.activity.update({
				where: { id: input.id },
				data: {
					...(input.subject !== undefined ? { subject: input.subject } : {}),
					...(input.body !== undefined
						? { body: blankToNull(input.body ?? "") }
						: {}),
					...(input.dueAt !== undefined
						? { dueAt: parseDate(input.dueAt) }
						: {}),
					...(input.assigneeId !== undefined
						? { assigneeId: input.assigneeId }
						: {}),
					...(input.priority !== undefined ? { priority: input.priority } : {}),
				},
				select: ENTRY_SELECT,
			});
		});
		return serializeEntry(updated);
	}

	async myTasks(
		input: MyTasksInput,
		actingUserId: string,
	): Promise<ActivityEntry[]> {
		input = validate(myTasksInput, input);
		await this.readMember(actingUserId);
		const now = new Date();
		const where: Prisma.ActivityWhereInput = {
			type: ActivityType.TASK,
			completedAt: input.window === "completed" ? { not: null } : null,
			assigneeId: actingUserId,
			AND: [
				{ OR: [{ companyId: null }, { company: { archivedAt: null } }] },
				{ OR: [{ contactId: null }, { contact: { archivedAt: null } }] },
				{ OR: [{ dealId: null }, { deal: { archivedAt: null } }] },
			],
		};

		if (input.window === "overdue") where.dueAt = { lt: now };
		if (input.window === "upcoming") where.dueAt = { gte: now };

		const tasks = await this.db.activity.findMany({
			where,
			take: input.limit,
			orderBy: [
				{ priority: "desc" },
				{ dueAt: { sort: "asc", nulls: "last" } },
				{ createdAt: "desc" },
				{ id: "desc" },
			],
			select: ENTRY_SELECT,
		});

		return tasks.map(serializeEntry);
	}

	private anchor(
		input: Pick<TimelineInput, "companyId" | "contactId" | "dealId">,
	): Prisma.ActivityWhereInput {
		if (input.dealId) return { dealId: input.dealId };
		if (input.contactId) return { contactId: input.contactId };
		if (input.companyId) return { companyId: input.companyId };
		throw new BadRequestException(
			"A timeline needs a company, a contact or a deal.",
		);
	}

	private async resolveRelations(
		tx: Prisma.TransactionClient,
		input: {
			companyId?: string | null;
			contactId?: string | null;
			dealId?: string | null;
		},
	): Promise<string | null> {
		let companyId = input.companyId ?? null;
		let contactCompanyId: string | null | undefined;
		if (input.dealId) {
			await tx.$queryRaw`SELECT id FROM "deal" WHERE id = ${input.dealId} FOR SHARE`;
			const deal = await tx.deal.findUnique({
				where: { id: input.dealId },
				select: { companyId: true, archivedAt: true },
			});
			if (!deal) {
				throw new NotFoundException(`No deal with id ${input.dealId}.`);
			}
			if (deal.archivedAt)
				throw new BadRequestException(
					"Restore the opportunity before changing its activities.",
				);
			if (companyId && companyId !== deal.companyId)
				throw new BadRequestException(
					"The opportunity belongs to another company.",
				);
			companyId = deal.companyId;
		}

		if (input.contactId) {
			await tx.$queryRaw`SELECT id FROM "contact" WHERE id = ${input.contactId} FOR SHARE`;
			const contact = await tx.contact.findUnique({
				where: { id: input.contactId },
				select: { companyId: true, archivedAt: true },
			});
			if (!contact) {
				throw new NotFoundException(`No contact with id ${input.contactId}.`);
			}
			if (contact.archivedAt)
				throw new BadRequestException(
					"Restore the contact before changing its activities.",
				);
			contactCompanyId = contact.companyId;
			if (companyId && companyId !== contactCompanyId)
				throw new BadRequestException(
					"The contact belongs to another company.",
				);
			companyId ??= contactCompanyId;
		}
		if (companyId) {
			await tx.$queryRaw`SELECT id FROM "company" WHERE id = ${companyId} FOR SHARE`;
			const company = await tx.company.findUnique({
				where: { id: companyId },
				select: { id: true, archivedAt: true },
			});
			if (!company)
				throw new NotFoundException(`No company with id ${companyId}.`);
			if (company.archivedAt)
				throw new BadRequestException(
					"Restore the company before changing its activities.",
				);
		}
		return companyId;
	}

	private async readMember(userId: string) {
		const member = await this.db.member.findFirst({
			where: { organizationId: WORKSPACE_ID, userId, suspendedAt: null },
			select: { role: true },
		});
		return memberRole(member?.role);
	}

	private async lockMember(tx: Prisma.TransactionClient, userId: string) {
		if (!userId)
			throw new ForbiddenException(
				"An active workspace membership is required.",
			);
		const members = await tx.$queryRaw<{ role: string }[]>`
			SELECT role FROM "member" WHERE "organizationId" = ${WORKSPACE_ID} AND "userId" = ${userId} AND "suspendedAt" IS NULL FOR SHARE
		`;
		return memberRole(members[0]?.role);
	}

	private async lockTask(tx: Prisma.TransactionClient, id: string) {
		await tx.$queryRaw`SELECT id FROM "activity" WHERE id = ${id} FOR UPDATE`;
		const activity = await tx.activity.findUnique({
			where: { id },
			select: {
				type: true,
				createdById: true,
				assigneeId: true,
				completedAt: true,
				companyId: true,
				contactId: true,
				dealId: true,
			},
		});
		if (!activity) throw new NotFoundException(`No activity with id ${id}.`);
		if (activity.type !== ActivityType.TASK)
			throw new BadRequestException("Only tasks support this action.");
		return activity;
	}

	private assertTaskActor(
		activity: { createdById: string; assigneeId: string | null },
		userId: string,
		role: string,
	) {
		if (
			role === "owner" ||
			role === "admin" ||
			activity.createdById === userId ||
			activity.assigneeId === userId
		)
			return;
		throw new ForbiddenException(
			"Only the task author, assignee, owner or admin can change this task.",
		);
	}

	private assertAssignmentRole(role: string) {
		if (role === "owner" || role === "admin") return;
		throw new ForbiddenException(
			"Only an owner or admin can assign work to another person.",
		);
	}

	private async mutate<T>(
		work: (tx: Prisma.TransactionClient) => Promise<T>,
	): Promise<T> {
		try {
			return await this.db.$transaction(work, {
				isolationLevel: "Serializable",
			});
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "P2034") {
				throw new ConflictException(
					"The task or membership changed. Reload and retry.",
				);
			}
			throw error;
		}
	}
}

function memberRole(role: string | undefined) {
	if (role === "owner" || role === "admin" || role === "member") return role;
	throw new ForbiddenException(
		"An active workspace membership with a supported role is required.",
	);
}

function validate<S extends z.ZodType>(
	schema: S,
	input: z.input<S>,
): z.output<S> {
	const result = schema.safeParse(input);
	if (!result.success)
		throw new BadRequestException(
			result.error.issues.map((issue) => issue.message).join(" "),
		);
	return result.data;
}

function filterClause(filter: TimelineFilter): Prisma.ActivityWhereInput {
	switch (filter) {
		case "notes":
			return { type: { in: NOTE_TYPES } };
		case "upcoming":
			return { type: ActivityType.TASK, completedAt: null };
		case "done":
			return { type: ActivityType.TASK, completedAt: { not: null } };
		case "history":
			return { NOT: { type: ActivityType.TASK, completedAt: null } };
		case "email":
			return { type: ActivityType.EMAIL };
		case "meetings":
			return { type: ActivityType.MEETING };
		case "all":
			return {};
	}
}

type Entry = Prisma.ActivityGetPayload<{ select: typeof ENTRY_SELECT }>;

function serializeEntry(entry: Entry) {
	return {
		...entry,
		occurredAt: entry.occurredAt?.toISOString() ?? null,
		dueAt: entry.dueAt?.toISOString() ?? null,
		completedAt: entry.completedAt?.toISOString() ?? null,
		createdAt: entry.createdAt.toISOString(),
		meta: activityMeta.parse(entry.meta),

		emailThread: entry.emailThread
			? {
					id: entry.emailThread.id,
					messageCount: entry.emailThread.messageCount,
					lastMessageAt: entry.emailThread.lastMessageAt.toISOString(),
				}
			: null,

		calendarEvent: entry.calendarEvent
			? {
					id: entry.calendarEvent.id,
					startsAt: entry.calendarEvent.startsAt.toISOString(),
					endsAt: entry.calendarEvent.endsAt.toISOString(),
					isAllDay: entry.calendarEvent.isAllDay,
					location: entry.calendarEvent.location,
					conferenceUrl: entry.calendarEvent.conferenceUrl,
					attendeeCount: entry.calendarEvent._count.attendees,
				}
			: null,
	};
}

function parseDate(value: string | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new BadRequestException(`"${value}" is not a date.`);
	}
	return date;
}
