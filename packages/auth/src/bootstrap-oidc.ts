import type { SSOOptions } from "@better-auth/sso";
import { APIError } from "better-auth/api";
import { z } from "zod";

export const BOOTSTRAP_PROVIDER_ID = "bootstrap-oidc";
export const BOOTSTRAP_IDENTITY_SCOPES = [
	"openid",
	"email",
	"profile",
] as const;

const issuerSchema = z
	.url()
	.max(512)
	.refine((value) => {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.search &&
			!url.hash
		);
	});

const bootstrapSchema = z.strictObject({
	issuer: issuerSchema,
	domain: z
		.string()
		.trim()
		.toLowerCase()
		.max(253)
		.regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/),
	clientId: z.string().trim().min(1).max(512),
	clientSecret: z
		.string()
		.min(1)
		.max(1024)
		.refine((value) => value.trim().length > 0),
});

export type BootstrapOidc = NonNullable<SSOOptions["defaultSSO"]>[number];

export function readBootstrapOidc(
	raw: string | undefined,
): BootstrapOidc | undefined {
	if (raw === undefined || raw.trim() === "") return undefined;
	try {
		const config = bootstrapSchema.parse(JSON.parse(raw));
		return {
			providerId: BOOTSTRAP_PROVIDER_ID,
			domain: config.domain,
			oidcConfig: {
				issuer: config.issuer,
				discoveryEndpoint: `${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
				clientId: config.clientId,
				clientSecret: config.clientSecret,
				pkce: true,
				scopes: [...BOOTSTRAP_IDENTITY_SCOPES],
			},
		};
	} catch {
		throw new Error(
			"Invalid CRM_BOOTSTRAP_OIDC. See docs/bootstrap-oidc.md. Configuration values are redacted.",
		);
	}
}

export function bootstrapSignInProviders(config: BootstrapOidc | undefined) {
	return config
		? [{ providerId: BOOTSTRAP_PROVIDER_ID, name: "Bootstrap OIDC" }]
		: [];
}

export function bootstrapTrustedOrigins(
	config: BootstrapOidc | undefined,
	appOrigins: readonly string[],
) {
	return [
		...new Set([
			...appOrigins,
			...(config?.oidcConfig ? [new URL(config.oidcConfig.issuer).origin] : []),
		]),
	];
}

const callbackRequest = z.object({
	callbackURL: z.string(),
	errorCallbackURL: z.string().optional(),
	newUserCallbackURL: z.string().optional(),
});

export function assertBootstrapOrigins(
	path: string,
	body: unknown,
	origin: string | null,
	appOrigins: readonly string[],
): void {
	if (origin && !appOrigins.includes(origin)) {
		throw new APIError("FORBIDDEN", {
			message: "Bootstrap requests require an application origin.",
		});
	}
	if (path !== "/sign-in/sso") return;
	const parsed = callbackRequest.safeParse(body);
	if (!parsed.success)
		throw new APIError("BAD_REQUEST", {
			message: "Invalid bootstrap callback.",
		});
	for (const value of Object.values(parsed.data)) {
		if (!value) continue;
		let allowed = false;
		try {
			const url = new URL(value, appOrigins[0]);
			allowed =
				appOrigins.includes(url.origin) && !url.username && !url.password;
		} catch {}
		if (!allowed)
			throw new APIError("FORBIDDEN", {
				message: "Bootstrap callback requires an application origin.",
			});
	}
}

const scopeRequest = z.object({ scopes: z.array(z.string()).optional() });

export function assertBootstrapIdentityScopes(
	path: string,
	body: unknown,
): void {
	if (path !== "/sign-in/sso") return;
	const parsed = scopeRequest.safeParse(body);
	if (
		!parsed.success ||
		parsed.data.scopes?.some(
			(scope) =>
				!(BOOTSTRAP_IDENTITY_SCOPES as readonly string[]).includes(scope),
		)
	) {
		throw new APIError("BAD_REQUEST", {
			message: "Bootstrap mode permits identity scopes only.",
		});
	}
}
