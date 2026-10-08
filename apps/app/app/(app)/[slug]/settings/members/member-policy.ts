export const MEMBER_ROLE_LABEL = {
	owner: "Propietario",
	admin: "Administrador",
	member: "Miembro",
} as const;

export type MemberRole = keyof typeof MEMBER_ROLE_LABEL;
export const IDENTITY_AUDIT_UI = {
	pageSize: 25,
	dateOptions: { dateStyle: "short", timeStyle: "short" },
} as const;
export function memberActions(
	actor: string | null | undefined,
	target: { role: string; isViewer: boolean },
) {
	const owner = actor === "owner";
	const limitedAdmin = actor === "admin" && target.role === "member";
	return {
		canManage: owner || limitedAdmin,
		canResetPassword: (owner || limitedAdmin) && !target.isViewer,
		roleOptions: owner
			? (["owner", "admin", "member"] as const)
			: ([] as const),
	};
}

export function creatableRoles(
	actor: string | null | undefined,
): readonly ("admin" | "member")[] {
	if (actor === "owner") return ["admin", "member"];
	if (actor === "admin") return ["member"];
	return [];
}
