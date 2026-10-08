import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type {
	MiddlewareOptions,
	MiddlewareResponse,
	TRPCMiddleware,
} from "nestjs-trpc";
import { InjectDatabase } from "../../database/database.constants";
import { setRequestUserId } from "../../logging/request-context";
import type { AuthedTrpcContext, BaseTrpcContext } from "../context.types";

@Injectable()
export class AuthMiddleware implements TRPCMiddleware {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async use(opts: MiddlewareOptions): Promise<MiddlewareResponse> {
		const ctx = opts.ctx as BaseTrpcContext;
		const user = ctx.session?.user;

		if (!user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}
		const workspaceRole = await workspaceRoleOf(user.id, this.db);
		if (!workspaceRole)
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "La cuenta no tiene acceso activo a esta instalación.",
			});

		setRequestUserId(user.id);

		const nextCtx: AuthedTrpcContext = { ...ctx, user, workspaceRole };
		return opts.next({ ctx: nextCtx });
	}
}

import { workspaceRoleOf } from "@crm/auth";
import type { Db } from "@crm/db";
