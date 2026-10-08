import {
	type AuthFn,
	extractBearerToken,
	localDev,
	vercelOidc,
	verifyJwtHmac,
	withAuthChallenges,
} from "eve/channels/auth";
import type { Channel } from "eve/channels";
import { eveChannel } from "eve/channels/eve";
import { guardAiMessageRoute } from "../lib/ai-policy";

export const BRIDGE_ISSUER = "crm-app";
export const BRIDGE_AUDIENCE = "crm-agent";

export function repFromCrm(secret: string): AuthFn<Request> {
	return withAuthChallenges(
		async (request: Request) => {
			const result = await verifyJwtHmac(
				extractBearerToken(request.headers.get("authorization")),
				{
					algorithm: "HS256",
					audiences: [BRIDGE_AUDIENCE],
					issuer: BRIDGE_ISSUER,
					secret,
				},
			);

			if (!result.ok) return null;

			const claims = result.sessionAuth;
			const userId = claims.subject;
			if (!userId) return null;

			return {
				attributes: claims.attributes ?? {},
				authenticator: "crm-app",
				principalId: userId,
				principalType: "user" as const,
			};
		},
		[{ scheme: "Bearer" }],
	);
}

const secret = process.env.AGENT_BRIDGE_SECRET;

const channel = eveChannel({
	auth: [...(secret ? [repFromCrm(secret)] : []), vercelOidc(), localDev()],
});

const guardedChannel: Channel = {
	...channel,
	routes: channel.routes.map(guardAiMessageRoute),
};

export default guardedChannel;
