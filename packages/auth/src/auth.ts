import { apiKey } from "@better-auth/api-key";
import { sso } from "@better-auth/sso";
import { db } from "@crm/db";
import { schemas } from "@crm/validation";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { organization } from "better-auth/plugins/organization";
import { ACCESS } from "./access-config";
import { API_KEY_EXPIRATION, API_KEY_HEADER, API_KEY_PREFIX } from "./api-keys";
import { AUTH_COOKIE_PREFIX } from "./cookies";
import { env } from "./env";
import { WORKSPACE_ID, workspaceRoleOf } from "./organization";
import {
	GOOGLE_PROVIDER_ID,
	MICROSOFT_PROVIDER_ID,
	MICROSOFT_SYNC_SCOPES,
	SLACK_PROVIDER_ID,
	SYNC_SCOPES,
} from "./scopes";
import { notifySignedIn } from "./signed-in";
import { slackConnectGuard } from "./slack-connect";
import { rememberSlackInstall, replaceSlackConnection } from "./slack-grant";
import { SLACK_REQUESTED_SCOPES, SLACK_USER_SCOPES } from "./slack-scopes";
import { queueSlackInventorySync } from "./slack-sync";
import { isWorkspaceEmail, primaryWorkspaceDomain } from "./workspace";

const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};
const slackOAuth = env.slack;
const slackRedirectUri = new URL(
	"/api/auth/oauth2/callback/slack",
	env.apiUrl,
).toString();

const workspacePlugin = organization({
	allowUserToCreateOrganization: false,
	disableOrganizationDeletion: true,
	creatorRole: "owner",
	schema: {
		organization: {
			additionalFields: { website: { type: "string", required: false } },
		},
	},
});
const keyPlugin = apiKey({
	apiKeyHeaders: API_KEY_HEADER,
	defaultPrefix: API_KEY_PREFIX,
	enableSessionForAPIKeys: true,
	requireName: true,
	defaultKeyLength: 32,
	maximumNameLength: 64,
	rateLimit: { enabled: false },
	keyExpiration: {
		maxExpiresIn: API_KEY_EXPIRATION.maxDays,
		minExpiresIn: API_KEY_EXPIRATION.minDays,
	},
});

if (env.google) {
	const google: NonNullable<typeof socialProviders.google> = {
		...env.google,

		scope: [...SYNC_SCOPES],

		accessType: "offline",
	};

	const hostedDomain = primaryWorkspaceDomain();
	if (hostedDomain) google.hd = hostedDomain;

	socialProviders.google = google;
}

if (env.microsoft) {
	socialProviders.microsoft = {
		clientId: env.microsoft.clientId,
		clientSecret: env.microsoft.clientSecret,
		tenantId: env.microsoft.tenantId,

		scope: [...MICROSOFT_SYNC_SCOPES],

		prompt: "select_account",

		disableProfilePhoto: true,

		mapProfileToUser: (profile) => ({
			email: profile.email ?? profile.preferred_username ?? profile.upn,
		}),
	};
}

export const auth = betterAuth({
	appName: "CRM",
	baseURL: env.apiUrl,

	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	disabledPaths: [
		...Object.values(workspacePlugin.endpoints).map(
			(endpoint) => endpoint.path,
		),
		...Object.values(keyPlugin.endpoints).map((endpoint) => endpoint.path),
	],

	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		minPasswordLength: ACCESS.password.minLength,
		maxPasswordLength: ACCESS.password.maxLength,
	},

	socialProviders,

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: [GOOGLE_PROVIDER_ID, MICROSOFT_PROVIDER_ID],
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: {
			enabled: false,
		},
	},

	rateLimit: {
		enabled: true,
		storage: "database",
	},

	advanced: {
		cookiePrefix: AUTH_COOKIE_PREFIX,

		useSecureCookies: env.isProduction,
		...(env.cookieDomain && {
			crossSubDomainCookies: {
				enabled: true,
				domain: env.cookieDomain,
			},
		}),
	},

	trustedOrigins: [...env.trustedOrigins],
	hooks: {
		before: slackConnectGuard,
	},

	plugins: [
		...(slackOAuth
			? [
					genericOAuth({
						config: [
							{
								providerId: SLACK_PROVIDER_ID,
								authorizationUrl: "https://slack.com/oauth/v2/authorize",
								tokenUrl: "https://slack.com/api/oauth.v2.access",
								clientId: slackOAuth.clientId,
								clientSecret: slackOAuth.clientSecret,
								disableSignUp: true,
								redirectURI: slackRedirectUri,
								scopes: [...SLACK_REQUESTED_SCOPES],
								authorizationUrlParams: {
									user_scope: SLACK_USER_SCOPES.join(","),
								},
								getToken: async ({ code }) => {
									const response = await fetch(
										"https://slack.com/api/oauth.v2.access",
										{
											method: "POST",
											headers: {
												"content-type": "application/x-www-form-urlencoded",
											},
											body: new URLSearchParams({
												client_id: slackOAuth.clientId,
												client_secret: slackOAuth.clientSecret,
												code,
												redirect_uri: slackRedirectUri,
											}),
										},
									);
									const grant = schemas.slack.oauthAccess.parse(
										await response.json(),
									);
									if (!response.ok || !grant.ok || !grant.access_token) {
										throw new APIError("BAD_REQUEST", {
											message: `Slack authorization failed (${grant.error ?? "rejected"}).`,
										});
									}
									await rememberSlackInstall(grant);

									return {
										accessToken: grant.access_token,
										tokenType: grant.token_type,
										scopes: (grant.scope ?? "")
											.split(",")
											.map((scope) => scope.trim())
											.filter(Boolean),
										raw: grant,
									};
								},
								getUserInfo: async (tokens) => {
									try {
										const granted = schemas.slack.oauthAccess.parse(tokens.raw);
										const userId = granted.authed_user?.id;
										if (!tokens.accessToken || !userId) return null;
										const userResponse = await fetch(
											`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`,
											{
												headers: {
													Authorization: `Bearer ${tokens.accessToken}`,
												},
											},
										);
										const profile = schemas.slack.userInfo.parse(
											await userResponse.json(),
										);
										if (!userResponse.ok || !profile.ok) return null;
										const details = profile.user.profile;
										const email = details.email;
										if (!email) return null;
										return {
											id: userId,
											name: details.real_name ?? profile.user.name ?? email,
											email,
											emailVerified: true,
											image: details.image_512,
										};
									} catch {
										return null;
									}
								},
							},
						],
					}),
				]
			: []),
		workspacePlugin,

		sso({
			organizationProvisioning: { disabled: true },
		}),

		keyPlugin,
	],

	databaseHooks: {
		account: {
			create: {
				after: replaceSlackAccount,
			},
			update: {
				after: replaceSlackAccount,
			},
		},

		user: {
			create: {
				before: async () => {
					throw new APIError("FORBIDDEN", {
						message:
							"El registro público está cerrado. Solicita una cuenta al administrador.",
					});
				},
			},
		},

		session: {
			create: {
				before: async (session) => {
					const [user, role] = await Promise.all([
						db.user.findUnique({
							where: { id: session.userId },
							select: { email: true },
						}),
						workspaceRoleOf(session.userId),
					]);
					if (!user || !role || !isWorkspaceEmail(user.email)) {
						throw new APIError("FORBIDDEN", {
							message: "Solicita acceso al administrador de esta instalación.",
						});
					}

					return {
						data: { ...session, activeOrganizationId: WORKSPACE_ID },
					};
				},

				after: async (session) => {
					const user = await db.user.findUnique({
						where: { id: session.userId },
						select: { id: true, email: true },
					});

					if (user) await notifySignedIn(user);
				},
			},
		},
	},
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];

async function replaceSlackAccount(account: {
	id: string;
	accountId: string;
	providerId: string;
}): Promise<void> {
	if (account.providerId !== SLACK_PROVIDER_ID) return;
	await replaceSlackConnection(account);
	await queueSlackInventorySync();
}
