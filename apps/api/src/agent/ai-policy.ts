import { type AiFeaturePolicy, aiFeaturePolicy } from "@crm/env/features";
import { ForbiddenException } from "@nestjs/common";
import { z } from "zod";

export const aiPolicyOutput = z.discriminatedUnion("enabled", [
	z.object({ enabled: z.literal(true), status: z.literal("enabled") }),
	z.object({
		enabled: z.literal(false),
		status: z.literal("disabled"),
		code: z.literal("CRM_AI_DISABLED"),
		flag: z.literal("CRM_AI_ENABLED"),
		reason: z.string(),
	}),
]);

export class AiPolicyDisabledException extends ForbiddenException {
	readonly code = "CRM_AI_DISABLED";

	constructor(readonly policy: Extract<AiFeaturePolicy, { enabled: false }>) {
		super({
			message: `${policy.code}: ${policy.reason}`,
			code: policy.code,
			feature: policy,
		});
	}
}

export function requireApiAiEnabled(): void {
	const policy = aiFeaturePolicy();
	if (!policy.enabled) throw new AiPolicyDisabledException(policy);
}
