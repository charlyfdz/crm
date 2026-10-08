import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { SessionOnlyMiddleware } from "../trpc/middlewares/session-only.middleware";
import { restMeta } from "../trpc/openapi";
import {
	createMemberInput,
	identityAuditInput,
	identityAuditOutput,
	memberListInput,
	memberListOutput,
	resetMemberPasswordInput,
	setMemberRoleInput,
	setMemberStatusInput,
	updateWorkspaceInput,
	workspaceMemberOutput,
	workspaceOutput,
} from "./workspace.contracts";
import { WorkspaceService } from "./workspace.service";

@Router({ alias: "workspace" })
@UseMiddlewares(AuthMiddleware)
export class WorkspaceRouter {
	constructor(
		@Inject(WorkspaceService) private readonly workspace: WorkspaceService,
	) {}

	@Query({
		output: workspaceOutput,
		meta: restMeta("GET", "/workspace", ["Workspace"]),
	})
	async get(@Ctx() ctx: AuthedTrpcContext) {
		return this.workspace.get(ctx.user.id);
	}

	@Query({
		input: memberListInput,
		output: memberListOutput,
		meta: restMeta("POST", "/workspace/members/search", ["Workspace"]),
	})
	async members(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof memberListInput>,
	) {
		return this.workspace.members(ctx.user.id, input);
	}

	@Mutation({
		input: updateWorkspaceInput,
		output: workspaceOutput,
		meta: restMeta("PATCH", "/workspace", ["Workspace"]),
	})
	@UseMiddlewares(SessionOnlyMiddleware)
	async update(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof updateWorkspaceInput>,
	) {
		return this.workspace.update(ctx.user.id, input);
	}

	@Mutation({
		input: setMemberRoleInput,
		output: workspaceMemberOutput,
		meta: restMeta("PATCH", "/workspace/members/{memberId}/role", [
			"Workspace",
		]),
	})
	@UseMiddlewares(SessionOnlyMiddleware)
	async setMemberRole(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setMemberRoleInput>,
	) {
		return this.workspace.setMemberRole(ctx.user.id, input);
	}

	@Mutation({ input: createMemberInput, output: workspaceMemberOutput })
	@UseMiddlewares(SessionOnlyMiddleware)
	async createMember(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createMemberInput>,
	) {
		return this.workspace.createMember(ctx.user.id, input);
	}

	@Mutation({ input: setMemberStatusInput, output: workspaceMemberOutput })
	@UseMiddlewares(SessionOnlyMiddleware)
	async setMemberStatus(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof setMemberStatusInput>,
	) {
		return this.workspace.setMemberStatus(ctx.user.id, input);
	}

	@Mutation({ input: resetMemberPasswordInput })
	@UseMiddlewares(SessionOnlyMiddleware)
	async resetMemberPassword(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof resetMemberPasswordInput>,
	) {
		return this.workspace.resetMemberPassword(ctx.user.id, input);
	}

	@Query({ input: identityAuditInput, output: identityAuditOutput })
	@UseMiddlewares(SessionOnlyMiddleware)
	async identityAudit(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof identityAuditInput>,
	) {
		return this.workspace.identityAudit(ctx.user.id, input);
	}
}
