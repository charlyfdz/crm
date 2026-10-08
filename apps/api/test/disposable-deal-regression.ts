import { type Db, db } from "@crm/db";

export function requireDisposableDealRegression() {
	const url = new URL(process.env.DATABASE_URL ?? "");
	if (
		(!(
			process.env.CRM_DEAL_REGRESSION_TEST === "1" &&
			url.pathname === "/crm_deal_regression_test"
		) &&
			!(
				process.env.CRM_RECORD_REGRESSION_TEST === "1" &&
				url.pathname === "/crm_record_regression_test"
			)) ||
		url.protocol !== "postgresql:" ||
		url.hostname !== "127.0.0.1" ||
		!url.port ||
		url.search ||
		url.hash ||
		process.env.TEST_DATABASE_URL !== url.toString() ||
		process.env.CRM_AI_ENABLED !== "false"
	)
		throw new Error(
			"Use test:deal-regressions or test:record-regressions with a disposable loopback fixture.",
		);
}

requireDisposableDealRegression();
globalThis.fetch = Object.assign(
	async () => {
		throw new Error(
			"External calls are forbidden in the disposable deal regressions.",
		);
	},
	{ preconnect: globalThis.fetch.preconnect },
);

export async function addFixtureMember(
	database: Db,
	userId: string,
	role = "member",
) {
	requireDisposableDealRegression();
	await database.organization.upsert({
		where: { id: "workspace" },
		create: {
			id: "workspace",
			slug: "empresa-ficticia",
			name: "Empresa ficticia",
			createdAt: new Date(),
		},
		update: {},
	});
	await database.member.upsert({
		where: { organizationId_userId: { organizationId: "workspace", userId } },
		create: {
			id: `fixture-member-${userId}`,
			organizationId: "workspace",
			userId,
			role,
			createdAt: new Date(),
		},
		update: { role, suspendedAt: null },
	});
}

export async function closeFixtureClient() {
	await db.$disconnect();
}
