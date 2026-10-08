import { ActivityType } from "@crm/db";
import { activityMeta } from "@crm/validation/activity-meta";
import { z } from "zod";

const COMPOSABLE_TYPES = [
	ActivityType.NOTE,
	ActivityType.CALL,
	ActivityType.EMAIL,
	ActivityType.MEETING,
	ActivityType.TASK,
] as const;

const composableEnum = z.enum(COMPOSABLE_TYPES);

const ALL_ACTIVITY_TYPES = [
	ActivityType.NOTE,
	ActivityType.CALL,
	ActivityType.EMAIL,
	ActivityType.MEETING,
	ActivityType.TASK,
	ActivityType.STAGE_CHANGE,
	ActivityType.ENRICHMENT,
] as const;

const activityTypeOutput = z.enum(ALL_ACTIVITY_TYPES);

const recordId = z.string().trim().min(1).max(120);
const instant = z.iso.datetime({ offset: true });
const taskPriority = z.number().int().min(0).max(3);

const TIMELINE_FILTERS = [
	"all",
	"history",
	"notes",
	"upcoming",
	"done",
	"email",
	"meetings",
] as const;

export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export const timelineInput = z.object({
	companyId: recordId.optional(),
	contactId: recordId.optional(),
	dealId: recordId.optional(),
	filter: z.enum(TIMELINE_FILTERS).default("all"),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(30),
});

export type TimelineInput = z.infer<typeof timelineInput>;

export const timelineCountsInput = z.object({
	companyId: recordId.optional(),
	contactId: recordId.optional(),
	dealId: recordId.optional(),
});

export const activityCreateInput = z
	.object({
		type: composableEnum,
		subject: z.string().trim().max(500).optional(),
		body: z.string().trim().max(10000).optional(),
		occurredAt: instant.optional(),
		dueAt: instant.nullable().optional(),
		companyId: recordId.optional(),
		contactId: recordId.optional(),
		dealId: recordId.optional(),
		assigneeId: recordId.optional(),
		priority: taskPriority.optional(),
	})
	.strict()
	.refine((input) => input.companyId || input.contactId || input.dealId, {
		message: "An activity has to be about a company, a contact or a deal.",
	})
	.refine(
		(input) => input.type !== ActivityType.TASK || Boolean(input.subject),
		{
			message: "A task needs a subject — it is the thing to do.",
			path: ["subject"],
		},
	)
	.refine(
		(input) =>
			input.type === ActivityType.TASK ||
			(input.assigneeId === undefined &&
				input.priority === undefined &&
				input.dueAt === undefined),
		{ message: "Assignment, priority and deadline apply only to tasks." },
	);

export type ActivityCreateInput = z.infer<typeof activityCreateInput>;

export const completeInput = z
	.object({
		id: recordId,
		completed: z.boolean().default(true),
	})
	.strict();

export const taskUpdateInput = z
	.object({
		id: recordId,
		subject: z.string().trim().min(1).max(500).optional(),
		body: z.string().trim().max(10000).nullable().optional(),
		dueAt: instant.nullable().optional(),
		assigneeId: recordId.optional(),
		priority: taskPriority.optional(),
	})
	.strict()
	.refine(
		(input) =>
			Object.entries(input).some(
				([key, value]) => key !== "id" && value !== undefined,
			),
		{ message: "Select at least one task field to change." },
	);

export type TaskUpdateInput = z.infer<typeof taskUpdateInput>;

export const myTasksInput = z.object({
	window: z.enum(["overdue", "upcoming", "all", "completed"]).default("all"),
	limit: z.number().int().min(1).max(100).default(25),
});

export type MyTasksInput = z.infer<typeof myTasksInput>;

const activityAuthorOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

const activityCompanyRefOutput = z
	.object({
		id: z.string(),
		name: z.string(),
	})
	.nullable();

const activityContactRefOutput = z
	.object({
		id: z.string(),
		firstName: z.string(),
		lastName: z.string().nullable(),
	})
	.nullable();

const activityDealRefOutput = z
	.object({
		id: z.string(),
		name: z.string(),
	})
	.nullable();

const activityEmailThreadOutput = z
	.object({
		id: z.string(),
		messageCount: z.number(),
		lastMessageAt: z.string(),
	})
	.nullable();

const activityCalendarEventOutput = z
	.object({
		id: z.string(),
		startsAt: z.string(),
		endsAt: z.string(),
		isAllDay: z.boolean(),
		location: z.string().nullable(),
		conferenceUrl: z.string().nullable(),
		attendeeCount: z.number(),
	})
	.nullable();

export const activityEntryOutput = z.object({
	id: z.string(),
	type: activityTypeOutput,
	subject: z.string().nullable(),
	body: z.string().nullable(),
	occurredAt: z.string().nullable(),
	dueAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	meta: activityMeta,
	createdAt: z.string(),
	createdBy: activityAuthorOutput,
	assignee: activityAuthorOutput.nullable(),
	priority: taskPriority,
	company: activityCompanyRefOutput,
	contact: activityContactRefOutput,
	deal: activityDealRefOutput,
	emailThread: activityEmailThreadOutput,
	calendarEvent: activityCalendarEventOutput,
});

export type ActivityEntry = z.infer<typeof activityEntryOutput>;

export const timelineOutput = z.object({
	entries: z.array(activityEntryOutput),
	nextCursor: z.string().nullable(),
});

export type TimelineResult = z.infer<typeof timelineOutput>;

export const timelineCountsOutput = z.object({
	all: z.number(),
	notes: z.number(),
	upcoming: z.number(),
	done: z.number(),
	email: z.number(),
	meetings: z.number(),
});

export type TimelineCounts = z.infer<typeof timelineCountsOutput>;

export const myTasksOutput = z.array(activityEntryOutput);

export const activityCreateOutput = activityEntryOutput;

export const completeOutput = activityEntryOutput;

export const taskUpdateOutput = activityEntryOutput;
