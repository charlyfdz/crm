import { type Db, db } from "@crm/db";
import { workspaceSlug } from "@crm/db/workspace";
import { hashPassword } from "better-auth/crypto";
import { ACCESS } from "./access-config";
import { identityManagerRole, lockWorkspaceIdentity } from "./identity";
import { WORKSPACE_ID } from "./organization";
import { provisionUserInput } from "./provision-input";
import { hasSignInAllowList, isWorkspaceEmail } from "./workspace";

export class ProvisionError extends Error {}
export class ProvisionDeniedError extends ProvisionError {}

export async function provisionUser(
	value: unknown,
	client: Db = db,
	actingUserId?: string,
) {
	const input = provisionUserInput.parse(value);
	if (!hasSignInAllowList() || !isWorkspaceEmail(input.email)) {
		throw new ProvisionError("Email is not permitted by ALLOWED_SIGN_IN.");
	}
	const password = await hashPassword(input.password);
	return client.$transaction(
		async (tx) => {
			await lockWorkspaceIdentity(tx);
			if (actingUserId) {
				const actorRole = await identityManagerRole(tx, actingUserId);
				if (
					!actorRole ||
					input.bootstrap ||
					(actorRole === "admin" && input.role !== "member")
				) {
					throw new ProvisionDeniedError(
						"No tienes permiso para crear esa cuenta.",
					);
				}
			}
			const owners = await tx.member.count({
				where: {
					organizationId: WORKSPACE_ID,
					role: "owner",
					suspendedAt: null,
				},
			});
			const users = await tx.user.count();
			if (input.bootstrap && (users !== 0 || owners !== 0)) {
				throw new ProvisionError(
					"Bootstrap requires an empty installation. No account changed.",
				);
			}
			if (!input.bootstrap && owners === 0) {
				throw new ProvisionError("Provision the installation owner first.");
			}
			if (
				await tx.user.findFirst({
					where: { email: { equals: input.email, mode: "insensitive" } },
					select: { id: true },
				})
			) {
				throw new ProvisionError(
					"An account already exists. Provisioning never replaces passwords.",
				);
			}
			await tx.organization.upsert({
				where: { id: WORKSPACE_ID },
				create: {
					id: WORKSPACE_ID,
					name: input.workspaceName,
					slug: workspaceSlug(input.workspaceName),
					createdAt: new Date(),
				},
				update: {},
			});
			const userId = crypto.randomUUID();
			const user = await tx.user.create({
				data: {
					id: userId,
					name: input.name,
					email: input.email,
					emailVerified: false,
				},
				select: { id: true, name: true, email: true },
			});
			await tx.account.create({
				data: {
					id: crypto.randomUUID(),
					accountId: userId,
					providerId: "credential",
					userId,
					password,
				},
			});
			await tx.member.create({
				data: {
					id: crypto.randomUUID(),
					organizationId: WORKSPACE_ID,
					userId,
					role: input.role,
					createdAt: new Date(),
				},
			});
			await tx.identityAuditEvent.create({
				data: {
					action: "PROVISION_USER",
					actorUserId: actingUserId ?? null,
					targetUserId: userId,
					nextRole: input.role,
					nextSuspended: false,
					reason: input.bootstrap
						? "operator-bootstrap"
						: actingUserId
							? "managed-account"
							: "operator-provision",
				},
			});
			return { user, role: input.role, workspaceId: WORKSPACE_ID };
		},
		{ timeout: ACCESS.provision.transactionTimeoutMs },
	);
}
