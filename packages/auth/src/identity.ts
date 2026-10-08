import type { Prisma } from "@crm/db";
import { ACCESS } from "./access-config";
import {
	WORKSPACE_ID,
	type WorkspaceRole,
	workspaceRoleOf,
} from "./organization";

export async function lockWorkspaceIdentity(tx: Prisma.TransactionClient) {
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ACCESS.provision.advisoryLock})`;
	await tx.$queryRaw`SELECT id FROM "member" WHERE "organizationId" = ${WORKSPACE_ID} ORDER BY id FOR UPDATE`;
}

export async function identityManagerRole(
	tx: Prisma.TransactionClient,
	userId: string,
) {
	const role = await workspaceRoleOf(userId, tx);
	return role === "owner" || role === "admin" ? role : null;
}

export function canManageMember(
	actor: WorkspaceRole | null,
	targetRole: string,
	nextRole?: string,
) {
	if (actor === "owner") return true;
	return (
		actor === "admin" &&
		targetRole === "member" &&
		(!nextRole || nextRole === "member")
	);
}

export async function revokeUserAccess(
	tx: Prisma.TransactionClient,
	userId: string,
) {
	await tx.session.deleteMany({ where: { userId } });
	await tx.apikey.updateMany({
		where: { referenceId: userId },
		data: { enabled: false },
	});
}
