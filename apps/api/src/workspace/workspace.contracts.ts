import { ACCESS, WORKSPACE_ROLES } from "@crm/auth";
import { MAX_SLUG } from "@crm/db/workspace";
import { z } from "zod";
import { listInput } from "../trpc/list-input";

export const memberListInput = listInput.extend({
	role: z.array(z.string()).default([]),
	activeOnly: z.boolean().default(false),
});

export type MemberListInput = z.infer<typeof memberListInput>;

export const updateWorkspaceInput = z.object({
	name: z.string().trim().min(1).max(120),
	website: z.string().trim().min(1).max(255),
	slug: z
		.string()
		.trim()
		.min(1)
		.max(MAX_SLUG)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		.optional(),
});

export const setMemberRoleInput = z.object({
	memberId: z.string().min(1),
	role: z.enum(WORKSPACE_ROLES),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInput>;
export type SetMemberRoleInput = z.infer<typeof setMemberRoleInput>;

export const createMemberInput = z
	.object({
		name: z.string().trim().min(1).max(120),
		email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
		password: z
			.string()
			.min(ACCESS.password.minLength)
			.max(ACCESS.password.maxLength),
		role: z.enum(["admin", "member"]).default("member"),
	})
	.strict();
export const setMemberStatusInput = z
	.object({
		memberId: z.string().min(1),
		suspended: z.boolean(),
		reason: z.string().trim().min(1).max(500),
	})
	.strict();
export const resetMemberPasswordInput = z
	.object({
		memberId: z.string().min(1),
		password: z
			.string()
			.min(ACCESS.password.minLength)
			.max(ACCESS.password.maxLength),
		reason: z.string().trim().min(1).max(500),
	})
	.strict();
export const identityAuditInput = listInput;
export type IdentityAuditInput = z.infer<typeof identityAuditInput>;
export const identityAuditOutput = z.object({
	rows: z.array(
		z.object({
			id: z.string(),
			createdAt: z.string(),
			action: z.string(),
			actorUserId: z.string().nullable(),
			targetUserId: z.string(),
			previousRole: z.string().nullable(),
			nextRole: z.string().nullable(),
			previousSuspended: z.boolean().nullable(),
			nextSuspended: z.boolean().nullable(),
			reason: z.string().nullable(),
		}),
	),
	total: z.number(),
	facetCounts: z.record(z.string(), z.record(z.string(), z.number())),
});
export type CreateMemberInput = z.infer<typeof createMemberInput>;
export type SetMemberStatusInput = z.infer<typeof setMemberStatusInput>;
export type ResetMemberPasswordInput = z.infer<typeof resetMemberPasswordInput>;

export const workspaceOutput = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	website: z.string().nullable(),
	onboarded: z.boolean(),
	viewerRole: z.enum(WORKSPACE_ROLES).nullable(),
	canRename: z.boolean(),
	canChangeRoles: z.boolean(),
	passwordPolicy: z.object({ minLength: z.number(), maxLength: z.number() }),
});

export type Workspace = z.infer<typeof workspaceOutput>;

export const workspaceMemberOutput = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	role: z.enum(WORKSPACE_ROLES),
	suspendedAt: z.string().nullable(),
	joinedAt: z.string(),
	isViewer: z.boolean(),
});

export type WorkspaceMember = z.infer<typeof workspaceMemberOutput>;

export const memberListOutput = z.object({
	rows: z.array(workspaceMemberOutput),
	total: z.number(),
	facetCounts: z.record(z.string(), z.record(z.string(), z.number())),
});
