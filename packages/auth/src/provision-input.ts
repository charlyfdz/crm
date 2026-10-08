import { z } from "zod";
import { ACCESS } from "./access-config";

export const provisionUserInput = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
	password: z.string().min(ACCESS.password.minLength).max(ACCESS.password.maxLength),
	role: z.enum(["owner", "admin", "member"]).default("member"),
	bootstrap: z.boolean().default(false),
	workspaceName: z.string().trim().min(1).max(120).default("CRM Corporativo"),
}).strict().superRefine((input, ctx) => {
	if (input.bootstrap !== (input.role === "owner")) {
		ctx.addIssue({ code: "custom", path: ["role"], message: "Only bootstrap can create an owner." });
	}
});

export type ProvisionUserInput = z.infer<typeof provisionUserInput>;
