export const AI_FEATURE_FLAG = "CRM_AI_ENABLED";
export const AI_DISABLED_REASON =
	"AI is disabled for this installation. Set CRM_AI_ENABLED=true to enable AI explicitly.";

export type FeatureEnvironment = {
	readonly CRM_AI_ENABLED?: string;
	readonly [name: string]: string | undefined;
};

export type AiFeaturePolicy =
	| { readonly enabled: true; readonly status: "enabled" }
	| {
			readonly enabled: false;
			readonly status: "disabled";
			readonly code: "CRM_AI_DISABLED";
			readonly flag: typeof AI_FEATURE_FLAG;
			readonly reason: string;
	  };

export function isAiEnabled(env: FeatureEnvironment = process.env): boolean {
	return env.CRM_AI_ENABLED === "true";
}

export function aiFeaturePolicy(
	env: FeatureEnvironment = process.env,
): AiFeaturePolicy {
	return isAiEnabled(env)
		? { enabled: true, status: "enabled" }
		: {
				enabled: false,
				status: "disabled",
				code: "CRM_AI_DISABLED",
				flag: AI_FEATURE_FLAG,
				reason: AI_DISABLED_REASON,
			};
}

export class AiDisabledError extends Error {
	readonly code = "CRM_AI_DISABLED";
	readonly status = "disabled";

	constructor() {
		super(AI_DISABLED_REASON);
		this.name = "AiDisabledError";
	}
}

export function requireAiEnabled(env: FeatureEnvironment = process.env): void {
	if (!isAiEnabled(env)) throw new AiDisabledError();
}
