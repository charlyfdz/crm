import {
	ACCESS,
	canChangeRole,
	canManageMember,
	canRenameWorkspace,
	identityManagerRole,
	isWorkspaceRole,
	lockWorkspaceIdentity,
	ProvisionDeniedError,
	ProvisionError,
	provisionUser,
	revokeUserAccess,
	WORKSPACE_ID,
	type WorkspaceRole,
	workspaceRoleOf,
} from "@crm/auth";
import type { Db, Prisma } from "@crm/db";
import { isOnboarded, markOnboarded, workspaceSlug } from "@crm/db/workspace";
import { isAiEnabled } from "@crm/env/features";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { hashPassword } from "better-auth/crypto";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { normalizeDomain } from "../companies/domain";
import { InjectDatabase } from "../database/database.constants";
import {
	countsByKey,
	type ListResult,
	type OrderByColumns,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	CreateMemberInput,
	IdentityAuditInput,
	MemberListInput,
	ResetMemberPasswordInput,
	SetMemberRoleInput,
	SetMemberStatusInput,
	UpdateWorkspaceInput,
	Workspace,
	WorkspaceMember,
} from "./workspace.contracts";

const MEMBER_SELECT = {
	id: true,
	role: true,
	suspendedAt: true,
	createdAt: true,
	userId: true,
	user: { select: { name: true, email: true, image: true } },
} as const;

const WORKSPACE_SELECT = {
	id: true,
	slug: true,
	name: true,
	website: true,
	metadata: true,
} as const;

type MemberRow = Prisma.MemberGetPayload<{ select: typeof MEMBER_SELECT }>;
type WorkspaceRow = Prisma.OrganizationGetPayload<{
	select: typeof WORKSPACE_SELECT;
}>;

const SORTABLE: OrderByColumns<Prisma.MemberOrderByWithRelationInput> = {
	name: (dir) => ({ user: { name: dir } }),
	email: (dir) => ({ user: { email: dir } }),
	role: (dir) => ({ role: dir }),
	joinedAt: (dir) => ({ createdAt: dir }),
};

function toRole(value: string): WorkspaceRole {
	if (!isWorkspaceRole(value))
		throw new ForbiddenException(
			"Rol no compatible. Solicita revisión al operador.",
		);
	return value;
}

@Injectable()
export class WorkspaceService {
	private readonly logger = new Logger(WorkspaceService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
	) {}

	async get(userId: string): Promise<Workspace> {
		const role = await this.requireMember(userId);
		const row = await this.readWorkspace();

		if (!row) {
			throw new ServiceUnavailableException(
				"The workspace could not be read. Sign in again in a moment.",
			);
		}

		return this.toWorkspace(row, role);
	}

	async update(
		userId: string,
		input: UpdateWorkspaceInput,
	): Promise<Workspace> {
		const website = normalizeDomain(input.website);

		if (!website) {
			throw new BadRequestException(
				"That is not a website. Enter the domain, like acme.com.",
			);
		}

		const result = await this.db.$transaction(async (tx) => {
			await lockWorkspaceIdentity(tx);
			const role = await identityManagerRole(tx, userId);
			if (!role || !canRenameWorkspace(role))
				throw new ForbiddenException(
					"Sólo propietario o administrador activo cambia la empresa.",
				);
			await tx.$queryRaw`SELECT id FROM organization WHERE id = ${WORKSPACE_ID} FOR UPDATE`;
			const before = await tx.organization.findUnique({
				where: { id: WORKSPACE_ID },
				select: { website: true, metadata: true },
			});
			if (!before)
				throw new ServiceUnavailableException(
					"La configuración de empresa no está disponible.",
				);
			const saved = await tx.organization.update({
				where: { id: WORKSPACE_ID },
				data: {
					name: input.name,
					slug: workspaceSlug(input.slug ?? input.name),
					website,
					metadata: markOnboarded(before.metadata, new Date()),
				},
				select: WORKSPACE_SELECT,
			});
			return {
				beforeWebsite: before.website,
				workspace: this.toWorkspace(saved, role),
			};
		});

		this.logger.log({ message: "Workspace updated", userId });

		if (isAiEnabled() && website !== result.beforeWebsite) {
			await this.agent.workspaceChanged(
				website,
				result.beforeWebsite
					? "The company using this CRM changed its website"
					: "The company using this CRM said what its website is",
			);
		}

		return result.workspace;
	}

	async members(
		userId: string,
		input: MemberListInput,
	): Promise<ListResult<WorkspaceMember>> {
		await this.requireMember(userId);
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, roles] = await Promise.all([
			this.db.member.findMany({
				where,
				skip,
				take,
				select: MEMBER_SELECT,
				orderBy: resolveOrderBy(input, SORTABLE, { createdAt: "asc" }),
			}),
			this.db.member.count({ where }),
			this.db.member.groupBy({
				by: ["role"],
				where: this.searchWhere(input.q, input.activeOnly),
				_count: { _all: true },
			}),
		]);

		return {
			rows: rows.map((row) => this.toMember(row, userId)),
			total,
			facetCounts: { role: countsByKey(roles, "role") },
		};
	}

	async setMemberRole(
		userId: string,
		input: SetMemberRoleInput,
	): Promise<WorkspaceMember> {
		const updated = await this.db.$transaction(async (tx) => {
			const target = await this.manageableTarget(
				tx,
				userId,
				input.memberId,
				input.role,
			);
			if (target.role === input.role) return target;
			await this.preserveOwner(tx, target, input.role, target.suspendedAt);
			const result = await tx.member.update({
				where: { id: target.id },
				data: { role: input.role },
				select: MEMBER_SELECT,
			});
			await revokeUserAccess(tx, target.userId);
			await tx.identityAuditEvent.create({
				data: {
					action: "CHANGE_ROLE",
					actorUserId: userId,
					targetUserId: target.userId,
					previousRole: target.role,
					nextRole: input.role,
					previousSuspended: Boolean(target.suspendedAt),
					nextSuspended: Boolean(target.suspendedAt),
				},
			});
			return result;
		});

		this.logger.log({
			message: "Workspace role changed",
			userId,
			memberId: updated.id,
			role: input.role,
		});

		return this.toMember(updated, userId);
	}

	async createMember(
		userId: string,
		input: CreateMemberInput,
	): Promise<WorkspaceMember> {
		try {
			const result = await provisionUser(input, this.db, userId);
			const member = await this.db.member.findUniqueOrThrow({
				where: {
					organizationId_userId: {
						organizationId: WORKSPACE_ID,
						userId: result.user.id,
					},
				},
				select: MEMBER_SELECT,
			});
			return this.toMember(member, userId);
		} catch (error) {
			if (error instanceof ProvisionDeniedError)
				throw new ForbiddenException(error.message);
			if (error instanceof ProvisionError)
				throw new BadRequestException(error.message);
			throw error;
		}
	}

	async setMemberStatus(
		userId: string,
		input: SetMemberStatusInput,
	): Promise<WorkspaceMember> {
		const updated = await this.db.$transaction(async (tx) => {
			const target = await this.manageableTarget(tx, userId, input.memberId);
			if (Boolean(target.suspendedAt) === input.suspended) return target;
			const suspendedAt = input.suspended ? new Date() : null;
			await this.preserveOwner(tx, target, target.role, suspendedAt);
			const result = await tx.member.update({
				where: { id: target.id },
				data: { suspendedAt },
				select: MEMBER_SELECT,
			});
			await revokeUserAccess(tx, target.userId);
			await tx.identityAuditEvent.create({
				data: {
					action: input.suspended ? "SUSPEND_USER" : "REACTIVATE_USER",
					actorUserId: userId,
					targetUserId: target.userId,
					previousRole: target.role,
					nextRole: target.role,
					previousSuspended: Boolean(target.suspendedAt),
					nextSuspended: input.suspended,
					reason: input.reason,
				},
			});
			return result;
		});
		return this.toMember(updated, userId);
	}

	async resetMemberPassword(
		userId: string,
		input: ResetMemberPasswordInput,
	): Promise<{ id: string }> {
		const password = await hashPassword(input.password);
		return this.db.$transaction(async (tx) => {
			const target = await this.manageableTarget(tx, userId, input.memberId);
			if (target.userId === userId)
				throw new ForbiddenException(
					"Cambia tu propia contraseña con la contraseña actual.",
				);
			const result = await tx.account.updateMany({
				where: { userId: target.userId, providerId: "credential" },
				data: { password },
			});
			if (!result.count)
				throw new BadRequestException("Esta cuenta no tiene contraseña local.");
			await revokeUserAccess(tx, target.userId);
			await tx.identityAuditEvent.create({
				data: {
					action: "RESET_PASSWORD",
					actorUserId: userId,
					targetUserId: target.userId,
					reason: input.reason,
				},
			});
			return { id: target.id };
		});
	}

	async identityAudit(userId: string, input: IdentityAuditInput) {
		if (!canChangeRole(await this.requireMember(userId)))
			throw new ForbiddenException(
				"Sólo propietario o administrador lee la auditoría de identidad.",
			);
		const { skip, take } = paginate(input);
		const where: Prisma.IdentityAuditEventWhereInput = input.q.trim()
			? {
					OR: [
						{ targetUserId: { contains: input.q.trim() } },
						{ actorUserId: { contains: input.q.trim() } },
						{ action: { contains: input.q.trim() } },
					],
				}
			: {};
		const [rows, total] = await Promise.all([
			this.db.identityAuditEvent.findMany({
				where,
				skip,
				take,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			}),
			this.db.identityAuditEvent.count({ where }),
		]);
		return {
			rows: rows.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
			})),
			total,
			facetCounts: {},
		};
	}

	private async requireMember(userId: string) {
		const role = await workspaceRoleOf(userId, this.db);
		if (!role)
			throw new ForbiddenException(
				"Se requiere una membresía activa con rol compatible.",
			);
		return role;
	}

	private async manageableTarget(
		tx: Prisma.TransactionClient,
		userId: string,
		memberId: string,
		nextRole?: string,
	) {
		await lockWorkspaceIdentity(tx);
		const actorRole = await identityManagerRole(tx, userId);
		if (!actorRole)
			throw new ForbiddenException("No puedes administrar usuarios.");
		const target = await tx.member.findFirst({
			where: { id: memberId, organizationId: WORKSPACE_ID },
			select: MEMBER_SELECT,
		});
		if (!target)
			throw new NotFoundException("Esa persona no pertenece a la instalación.");
		if (!canManageMember(actorRole, target.role, nextRole))
			throw new ForbiddenException(
				"Sólo un propietario administra propietarios, administradores o asigna esos roles.",
			);
		return target;
	}

	private async preserveOwner(
		tx: Prisma.TransactionClient,
		target: MemberRow,
		role: string,
		suspendedAt: Date | null,
	) {
		if (
			target.role !== "owner" ||
			target.suspendedAt ||
			(role === "owner" && !suspendedAt)
		)
			return;
		const count = await tx.member.count({
			where: { organizationId: WORKSPACE_ID, role: "owner", suspendedAt: null },
		});
		if (count <= 1)
			throw new ForbiddenException(
				"Debe quedar al menos un propietario activo.",
			);
	}

	private toMember(row: MemberRow, userId: string): WorkspaceMember {
		return {
			id: row.id,
			userId: row.userId,
			name: row.user.name,
			email: row.user.email,
			image: row.user.image,
			role: toRole(row.role),
			suspendedAt: row.suspendedAt?.toISOString() ?? null,
			joinedAt: row.createdAt.toISOString(),
			isViewer: row.userId === userId,
		};
	}

	private searchWhere(q: string, activeOnly = false): Prisma.MemberWhereInput {
		const term = q.trim();
		const where: Prisma.MemberWhereInput = { organizationId: WORKSPACE_ID };
		if (activeOnly) where.suspendedAt = null;

		if (term) {
			where.user = {
				OR: [
					{ name: { contains: term, mode: "insensitive" } },
					{ email: { contains: term, mode: "insensitive" } },
				],
			};
		}

		return where;
	}

	private buildWhere(input: MemberListInput): Prisma.MemberWhereInput {
		const where = this.searchWhere(input.q, input.activeOnly);

		if (input.role.length > 0) {
			where.role = { in: input.role };
		}

		return where;
	}

	private toWorkspace(row: WorkspaceRow, role: WorkspaceRole): Workspace {
		return {
			id: row.id,
			slug: row.slug,
			name: row.name,
			website: row.website,
			onboarded: isOnboarded(row.metadata),
			viewerRole: role,
			canRename: canRenameWorkspace(role),
			canChangeRoles: canChangeRole(role),
			passwordPolicy: ACCESS.password,
		};
	}

	private async readWorkspace() {
		return this.db.organization.findUnique({
			where: { id: WORKSPACE_ID },
			select: WORKSPACE_SELECT,
		});
	}
}
