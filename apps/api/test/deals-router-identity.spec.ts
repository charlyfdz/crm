import { describe, expect, it, mock } from "bun:test";
import * as databaseEnums from "../../../packages/db/src/generated/prisma/enums";
import type { DealsService } from "../src/deals/deals.service";
import type { AuthedTrpcContext } from "../src/trpc/context.types";

mock.module("@crm/db", () => databaseEnums);
mock.module("../src/trpc/middlewares/auth.middleware", () => ({
	AuthMiddleware: class {},
}));
mock.module("../src/deals/deals.service", () => ({ DealsService: class {} }));

const { DealsRouter } = await import("../src/deals/deals.router");
const { dealUpdateArgs, dealIdInput } = await import(
	"../src/deals/deals.contracts"
);
const ctx = {
	session: null,
	user: { id: "authenticated-synthetic" },
} as AuthedTrpcContext;
const input = {
	id: "record-synthetic",
	actingUserId: "forged-owner",
	ownerId: "target-member",
};
const cases = [
	{ method: "list", input, args: [input] },
	{ method: "byId", input: input.id, args: [input.id] },
	{ method: "create", input, args: [input] },
	{ method: "stageHistory", input: input.id, args: [input.id] },
	{
		method: "update",
		input: { id: input.id, data: input },
		args: [input.id, input],
	},
	{ method: "archive", input: input.id, args: [input.id] },
	{ method: "restore", input: input.id, args: [input.id] },
	{ method: "purge", input: input.id, args: [input.id] },
	{ method: "setStage", input, args: [input] },
	{ method: "contactOptions", input: input.id, args: [input.id] },
	{ method: "attachContact", input, args: [input] },
	{ method: "detachContact", input, args: [input] },
	{ method: "setContactRole", input, args: [input] },
	{ method: "bulkAssignOwner", input, args: [input] },
	{ method: "bulkSetStage", input, args: [input] },
	{ method: "bulkArchive", input: [input.id], args: [[input.id]] },
	{ method: "bulkRestore", input: [input.id], args: [[input.id]] },
	{ method: "bulkPurge", input: [input.id], args: [[input.id]] },
] as const;

describe("opportunity router identity forwarding without a transport or database", () => {
	for (const testCase of cases) {
		it(`${testCase.method} forwards the authenticated actor, not a submitted identity`, async () => {
			const forwarded = mock(async (..._args: unknown[]) => ({
				result: "synthetic",
			}));
			const router = new DealsRouter({
				[testCase.method]: forwarded,
			} as unknown as DealsService);
			const method = Reflect.get(router, testCase.method) as (
				...args: unknown[]
			) => Promise<unknown>;
			expect(await method.call(router, ctx, testCase.input)).toEqual({
				result: "synthetic",
			});
			expect(forwarded).toHaveBeenCalledTimes(1);
			expect(forwarded.mock.calls[0]).toEqual([...testCase.args, ctx.user.id]);
		});
	}
	it("drops submitted identity and retention guards from public contracts", () => {
		expect(
			dealUpdateArgs.parse({
				id: input.id,
				actingUserId: "forged-owner",
				data: input,
			}),
		).toEqual({
			id: input.id,
			data: { ownerId: "target-member" },
		});
		expect(
			dealIdInput.parse({
				id: input.id,
				archivedBefore: "2020-01-01",
				actingUserId: "forged-owner",
			}),
		).toEqual({ id: input.id });
	});
});
