export function migrationSteps({
	role,
	database,
	checkOnly = false,
	grantOnly = false,
}) {
	if (!/^[a-z][a-z0-9_]{0,62}$/.test(role ?? "") || role.startsWith("pg_")) {
		throw new Error(
			"CRM_DB_USER needs a safe non-reserved PostgreSQL role identifier",
		);
	}
	if (!/^[a-z][a-z0-9_]{0,62}$/.test(database ?? ""))
		throw new Error("Migration database needs a safe identifier");
	if (checkOnly && grantOnly) throw new Error("Choose one migration mode");
	const grants = `REVOKE ALL ON DATABASE "${database}" FROM PUBLIC;
GRANT CONNECT ON DATABASE "${database}" TO "${role}";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO "${role}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${role}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${role}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${role}";
REVOKE INSERT, UPDATE, DELETE ON TABLE public._prisma_migrations FROM "${role}";`;
	return [
		...(!checkOnly && !grantOnly ? [{ args: ["migrate", "deploy"] }] : []),
		...(!grantOnly
			? [
					{
						args: [
							"migrate",
							"diff",
							"--from-config-datasource",
							"--to-schema",
							"prisma/schema.prisma",
							"--exit-code",
						],
					},
				]
			: []),
		...(!checkOnly
			? [{ args: ["db", "execute", "--stdin"], input: grants }]
			: []),
	];
}
