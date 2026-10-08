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
import { restMeta } from "../trpc/openapi";
import {
	pipelineArchivedOutput,
	pipelineConfigureInput,
	pipelineIdInput,
	pipelineOutput,
	pipelinesListOutput,
} from "./pipelines.contracts";
import { PipelinesService } from "./pipelines.service";

@Router({ alias: "pipelines" })
@UseMiddlewares(AuthMiddleware)
export class PipelinesRouter {
	constructor(
		@Inject(PipelinesService) private readonly pipelines: PipelinesService,
	) {}
	@Query({
		output: pipelinesListOutput,
		meta: restMeta("GET", "/pipelines", ["Pipelines"]),
	})
	async list(@Ctx() ctx: AuthedTrpcContext) {
		return this.pipelines.list(ctx.user.id);
	}
	@Mutation({
		input: pipelineConfigureInput,
		output: pipelineOutput,
		meta: restMeta("POST", "/pipelines/configure", ["Pipelines"]),
	})
	async configure(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof pipelineConfigureInput>,
	) {
		return this.pipelines.configure(input, ctx.user.id);
	}
	@Mutation({
		input: pipelineIdInput,
		output: pipelineArchivedOutput,
		meta: restMeta("POST", "/pipelines/{id}/archive", ["Pipelines"]),
	})
	async archive(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.pipelines.archive(id, ctx.user.id);
	}
}
