import { WORKSPACE_ID } from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";

type Client = Db | Prisma.TransactionClient;
type RecordKind = "company" | "contact";
type Action = "edit" | "archive" | "restore" | "purge";
type RecordRow = {
	id: string;
	ownerId: string | null;
	archivedAt: Date | null;
	companyId?: string | null;
};

export async function recordMembership(
	client: Client,
	userId: string,
	options: {
		lock?: boolean;
		administrative?: boolean;
		ownerOnly?: boolean;
	} = {},
) {
	if (typeof userId !== "string" || !userId)
		throw new ForbiddenException(
			"Falta la identidad autenticada de la operación.",
		);
	if (options.lock)
		await client.$queryRaw`SELECT id FROM "member" WHERE "organizationId" = ${WORKSPACE_ID} AND "userId" = ${userId} FOR SHARE`;
	const member = await client.member.findUnique({
		where: { organizationId_userId: { organizationId: WORKSPACE_ID, userId } },
		select: { role: true, suspendedAt: true },
	});
	if (
		!member ||
		member.suspendedAt ||
		!["owner", "admin", "member"].includes(member.role) ||
		(options.administrative && !["owner", "admin"].includes(member.role)) ||
		(options.ownerOnly && member.role !== "owner")
	)
		throw new ForbiddenException("No tienes permiso para esta operación.");
	return member.role;
}

export async function recordOwner(
	tx: Prisma.TransactionClient,
	userId: string,
	role: string,
	ownerId: string | null,
) {
	if (role === "member" && ownerId !== userId)
		throw new ForbiddenException(
			"No tienes permiso para reasignar este registro.",
		);
	if (ownerId) await recordMembership(tx, ownerId, { lock: true });
	return ownerId;
}

export async function authorizedRecord(
	tx: Prisma.TransactionClient,
	kind: RecordKind,
	id: string,
	userId: string,
	action: Action,
) {
	const role = await recordMembership(tx, userId, { lock: true });
	const [record] =
		kind === "company"
			? await tx.$queryRaw<
					RecordRow[]
				>`SELECT id, "ownerId", "archivedAt" FROM company WHERE id = ${id} FOR UPDATE`
			: await tx.$queryRaw<
					RecordRow[]
				>`SELECT id, "ownerId", "companyId", "archivedAt" FROM contact WHERE id = ${id} FOR UPDATE`;
	if (!record) throw new NotFoundException("El registro no existe.");
	if (action === "purge") {
		if (role !== "owner")
			throw new ForbiddenException(
				"Sólo el propietario puede eliminar registros definitivamente.",
			);
		if (!record.archivedAt)
			throw new BadRequestException(
				"Archiva el registro antes de eliminarlo definitivamente.",
			);
	} else {
		if (role === "member" && record.ownerId !== userId)
			throw new ForbiddenException(
				"No tienes permiso para cambiar este registro.",
			);
		if (action === "edit" && record.archivedAt)
			throw new BadRequestException("Restaura el registro antes de cambiarlo.");
	}
	return { record, role };
}

export async function activeCompany(tx: Prisma.TransactionClient, id: string) {
	const [company] = await tx.$queryRaw<
		Array<{ archivedAt: Date | null }>
	>`SELECT "archivedAt" FROM company WHERE id = ${id} FOR SHARE`;
	if (!company) throw new NotFoundException("La empresa no existe.");
	if (company.archivedAt)
		throw new BadRequestException("Selecciona una empresa activa.");
}
