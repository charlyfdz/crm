import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	it,
} from "bun:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { z } from "zod";
import {
	businessMigrations,
	validateBusinessSchemaUrl,
} from "../scripts/verify-business-schema.mjs";

const migrationDirectory = new URL(
	"../../db/prisma/migrations/",
	import.meta.url,
);
const stages = [
	{ legacy: "DEMO_BOOKED", outcome: "OPEN", position: 0 },
	{ legacy: "QUALIFIED_TO_BUY", outcome: "OPEN", position: 1 },
	{ legacy: "DECISION_MAKER_BOUGHT_IN", outcome: "OPEN", position: 2 },
	{ legacy: "CONTRACT_SENT", outcome: "OPEN", position: 3 },
	{ legacy: "CLOSED_WON", outcome: "WON", position: 4 },
	{ legacy: "CLOSED_LOST", outcome: "LOST", position: 5 },
	{ legacy: "UNQUALIFIED_TO_BUY", outcome: "DISQUALIFIED", position: 6 },
];
const activityTypes = [
	"NOTE",
	"CALL",
	"EMAIL",
	"MEETING",
	"TASK",
	"STAGE_CHANGE",
	"ENRICHMENT",
];
const snapshotRow = z.object({ snapshot: z.string() });
const dealRow = z.object({
	id: z.string(),
	stage: z.string(),
	pipelineStageId: z.string(),
});
const assignmentRow = z.object({
	id: z.string(),
	type: z.string(),
	createdById: z.string(),
	assigneeId: z.string().nullable(),
	priority: z.number().int(),
	completedAt: z.string().nullable(),
});

type SqlConnection = {
	connect(): Promise<void>;
	end(): Promise<void>;
	query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
};

if (process.env.CRM_BUSINESS_SCHEMA_TEST === "1") {
	let client: SqlConnection | undefined;
	let ready = false;
	let dealSnapshot: z.infer<typeof snapshotRow>[];
	let activitySnapshot: z.infer<typeof snapshotRow>[];
	let savepoint = 0;

	async function query(sql: string, values?: unknown[]) {
		if (!client) throw new Error("The isolated SQL client is not ready.");
		return client.query(sql, values);
	}

	async function rows<T extends z.ZodType>(
		schema: T,
		sql: string,
		values?: unknown[],
	): Promise<z.infer<T>[]> {
		return z.array(schema).parse((await query(sql, values)).rows);
	}

	async function expectSqlError(
		sql: string,
		values: unknown[],
		code: string,
		message?: string,
	) {
		const name = `assertion_${++savepoint}`;
		await query(`SAVEPOINT ${name}`);
		let rejected: { code: string; message: string } | undefined;
		try {
			const literals = await rows(
				z.object({ literal: z.string() }),
				"SELECT quote_nullable(value) AS literal FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY AS args(value, ordinal) ORDER BY ordinal",
				[JSON.stringify(values)],
			);
			const statement = sql.replace(/\$(\d+)/g, (_match, index: string) => {
				const literal = literals[Number(index) - 1]?.literal;
				if (literal === undefined)
					throw new Error("Missing SQL fixture argument.");
				return literal;
			});
			const errors = await rows(
				z.object({
					error: z.object({ code: z.string(), message: z.string() }),
				}),
				"SELECT crm_business_schema_fixture.expect_error($1) AS error",
				[statement],
			);
			rejected = errors[0]?.error;
		} finally {
			await query(`ROLLBACK TO SAVEPOINT ${name}`);
			await query(`RELEASE SAVEPOINT ${name}`);
		}
		const error = z
			.object({ code: z.string(), message: z.string() })
			.parse(rejected);
		expect(error.code).toBe(code);
		if (message) expect(error.message).toContain(message);
	}

	async function insertDeal(
		id: string,
		stage = "DEMO_BOOKED",
		pipelineStageId: string | null = null,
	) {
		return query(
			'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "stage", "pipelineStageId", "updatedAt") VALUES ($1, $1, $2, $3, $4::"DealStage", $5, $6::timestamp)',
			[
				id,
				"synthetic-company",
				"synthetic-author",
				stage,
				pipelineStageId,
				"2026-09-01 08:09:10.123",
			],
		);
	}

	async function insertPipeline(id: string, isDefault = false) {
		await query(
			'INSERT INTO "pipeline" ("id", "name", "nameKey", "isDefault", "updatedAt") VALUES ($1, $1, $1, $2, CURRENT_TIMESTAMP)',
			[id, isDefault],
		);
	}

	async function insertStage(
		id: string,
		pipelineId = "pipeline-default",
		legacy = "CONTRACT_SENT",
		outcome = "OPEN",
	) {
		await query(
			'INSERT INTO "pipelineStage" ("id", "pipelineId", "name", "nameKey", "position", "outcome", "legacyStage") VALUES ($1, $2, $1, $1, 20, $3::"DealOutcome", $4::"DealStage")',
			[id, pipelineId, outcome, legacy],
		);
	}

	async function insertHistory(
		id: string,
		dealId = "legacy-CLOSED_WON",
		actorId = "synthetic-author",
	) {
		await query(
			'INSERT INTO "dealStageChange" ("id", "dealId", "actorId", "fromStageId", "fromStageName", "fromOutcome", "fromPipelineId", "fromPipelineName", "toStageId", "toStageName", "toOutcome", "toPipelineId", "toPipelineName", "reason", "occurredAt") VALUES ($1, $2, $3, $4, $5, $6::"DealOutcome", $7, $8, $9, $10, $11::"DealOutcome", $12, $13, $14, $15::timestamp)',
			[
				id,
				dealId,
				actorId,
				"stage-CONTRACT_SENT",
				"Propuesta histórica",
				"OPEN",
				"pipeline-default",
				"Proceso histórico",
				"stage-CLOSED_WON",
				"Ganado histórico",
				"WON",
				"pipeline-default",
				"Proceso histórico",
				"Aprobación sintética",
				"2026-09-12 16:17:18.987",
			],
		);
	}

	beforeAll(async () => {
		const connection = validateBusinessSchemaUrl(process.env.DATABASE_URL);
		if (process.env.TEST_DATABASE_URL !== connection.toString())
			throw new Error("The fixture URLs must match.");
		const nonce = z.uuid().parse(process.env.CRM_BUSINESS_SCHEMA_NONCE);
		const require = createRequire(
			new URL("../../db/package.json", import.meta.url),
		);
		const {
			Client,
		}: {
			Client: new (options: {
				connectionString: string;
				connectionTimeoutMillis: number;
			}) => SqlConnection;
		} = require("pg");
		client = new Client({
			connectionString: connection.toString(),
			connectionTimeoutMillis: 5_000,
		});
		await client.connect();
		const marker = await rows(
			z.object({ nonce: z.string() }),
			"SELECT nonce FROM crm_business_schema_fixture.isolation",
		);
		if (marker.length !== 1 || marker[0]?.nonce !== nonce)
			throw new Error("The database lacks this harness isolation marker.");
		const initial = await rows(
			z.object({
				users: z.string(),
				deals: z.string(),
				activities: z.string(),
				pipelines: z.string().nullable(),
			}),
			'SELECT (SELECT count(*)::text FROM "user") AS users, (SELECT count(*)::text FROM "deal") AS deals, (SELECT count(*)::text FROM "activity") AS activities, to_regclass(\'public.pipeline\')::text AS pipelines',
		);
		if (
			initial[0]?.users !== "0" ||
			initial[0]?.deals !== "0" ||
			initial[0]?.activities !== "0" ||
			initial[0]?.pipelines !== null
		)
			throw new Error("The test requires an empty pre-business fixture.");
		await query(`CREATE FUNCTION crm_business_schema_fixture.expect_error(statement TEXT) RETURNS JSONB LANGUAGE plpgsql AS $fixture$
			DECLARE error_code TEXT; error_message TEXT;
			BEGIN
				EXECUTE statement;
				RETURN jsonb_build_object('code', 'SUCCESS', 'message', 'The statement must reject this fixture.');
			EXCEPTION WHEN OTHERS THEN
				GET STACKED DIAGNOSTICS error_code = RETURNED_SQLSTATE, error_message = MESSAGE_TEXT;
				RETURN jsonb_build_object('code', error_code, 'message', error_message);
			END;
		$fixture$`);
		await query(
			'INSERT INTO "user" ("id", "name", "email", "updatedAt") VALUES ($1, $2, $3, $4::timestamp), ($5, $6, $7, $4::timestamp)',
			[
				"synthetic-author",
				"Autor sintético",
				"author@example.test",
				"2026-08-03 01:02:03.456",
				"synthetic-assignee",
				"Responsable sintético",
				"assignee@example.test",
			],
		);
		await query(
			'INSERT INTO "company" ("id", "name", "domain", "updatedAt") VALUES ($1, $2, $3, $4::timestamp)',
			[
				"synthetic-company",
				"Empresa ficticia",
				"crm-fixture.example.test",
				"2026-08-04 02:03:04.567",
			],
		);
		for (const [index, stage] of stages.entries()) {
			await query(
				'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "stage", "stageChangedAt", "amount", "currency", "baseAmount", "baseCurrency", "fxRate", "fxRateAt", "expectedCloseDate", "closedAt", "closedReason", "createdAt", "updatedAt", "description", "lastActivityAt", "archivedAt") VALUES ($1, $2, $3, $4, $5::"DealStage", $6::timestamp, $7::numeric, $8, $9::numeric, $10, $11::numeric, $12::timestamp, $13::timestamp, $14::timestamp, $15, $16::timestamp, $17::timestamp, $18, $19::timestamp, $20::timestamp)',
				[
					`legacy-${stage.legacy}`,
					`Oportunidad sintética ${index}`,
					"synthetic-company",
					"synthetic-author",
					stage.legacy,
					"2026-08-05 03:04:05.678",
					index === 0 ? "999999999999.99" : index === 1 ? null : "12345.67",
					index === 2 ? "EUR" : "USD",
					index === 0 ? "999999999999.9900" : index === 1 ? null : "13888.8788",
					index === 1 ? null : "USD",
					index === 1 ? null : index === 0 ? "1.0000000000" : "1.1250000000",
					index === 1 ? null : "2026-08-06 04:05:06.789",
					"2026-10-31 18:30:45.901",
					stage.outcome === "OPEN" ? null : "2026-09-15 15:16:17.234",
					stage.outcome === "OPEN" ? null : "Cierre ficticio con ñ",
					"2026-08-01 12:13:14.345",
					"2026-09-16 17:18:19.456",
					"Descripción ficticia",
					"2026-09-14 14:15:16.567",
					index === 6 ? "2026-09-20 19:20:21.678" : null,
				],
			);
		}
		for (const type of activityTypes) {
			await query(
				'INSERT INTO "activity" ("id", "type", "subject", "body", "occurredAt", "dueAt", "completedAt", "companyId", "dealId", "createdById", "meta", "createdAt", "updatedAt") VALUES ($1, $2::"ActivityType", $3, $4, $5::timestamp, $6::timestamp, NULL, $7, $8, $9, $10::jsonb, $11::timestamp, $12::timestamp)',
				[
					`legacy-${type}`,
					type,
					"Seguimiento ficticio",
					"Contenido ficticio",
					"2026-09-01 08:09:10.123",
					type === "TASK" ? "2026-10-03 11:12:13.456" : null,
					"synthetic-company",
					"legacy-DEMO_BOOKED",
					"synthetic-author",
					JSON.stringify({ fixture: true }),
					"2026-08-21 07:08:09.789",
					"2026-09-02 09:10:11.234",
				],
			);
		}
		await query(
			'INSERT INTO "activity" ("id", "type", "subject", "dueAt", "completedAt", "createdById", "createdAt", "updatedAt") VALUES ($1, \'TASK\', $2, $3::timestamp, $4::timestamp, $5, $6::timestamp, $7::timestamp)',
			[
				"legacy-TASK-completed",
				"Tarea completada ficticia",
				"2026-08-25 12:13:14.456",
				"2026-08-24 09:10:11.123",
				"synthetic-assignee",
				"2026-08-20 11:12:13.456",
				"2026-08-24 09:10:11.123",
			],
		);
		dealSnapshot = await rows(
			snapshotRow,
			'SELECT to_jsonb(d)::text AS snapshot FROM "deal" d ORDER BY "id"',
		);
		activitySnapshot = await rows(
			snapshotRow,
			'SELECT to_jsonb(a)::text AS snapshot FROM "activity" a ORDER BY "id"',
		);
		for (const name of businessMigrations)
			await query(
				await readFile(
					new URL(`${name}/migration.sql`, migrationDirectory),
					"utf8",
				),
			);
		ready = true;
	}, 30_000);

	beforeEach(async () => {
		if (ready) await query("BEGIN");
	});

	afterEach(async () => {
		if (ready) await query("ROLLBACK");
	});

	afterAll(async () => {
		await client?.end();
	});

	it("refuses remote, redirected, production and malformed connection strings", () => {
		for (const value of [
			undefined,
			"",
			"invalid",
			"postgresql://postgres:postgres@db.example.test:5432/crm_business_schema_test",
			"postgresql://postgres:postgres@100.64.0.1:5432/crm_business_schema_test",
			"postgresql://postgres:postgres@192.168.1.1:5432/crm_business_schema_test",
			"postgresql://postgres:postgres@localhost:5432/crm_business_schema_test",
			"postgresql://postgres:postgres@[::1]:5432/crm_business_schema_test",
			"postgresql://postgres:postgres@127.0.0.1:5432/crm",
			"postgresql://postgres:postgres@127.0.0.1:5432/crm_access_test",
			"postgresql://postgres:postgres@127.0.0.1/crm_business_schema_test",
			"postgresql://postgres:postgres@127.0.0.1:0/crm_business_schema_test",
			"postgresql://postgres:postgres@127.0.0.1:5432/crm_business_schema_test?host=db.example.test",
			"postgresql://postgres:postgres@127.0.0.1:5432/crm_business_schema_test?options=-csearch_path=production",
			"postgresql://postgres:postgres@127.0.0.1:5432/crm_business_schema_test#fragment",
			"http://postgres:postgres@127.0.0.1:5432/crm_business_schema_test",
			"postgresql://real:secret@127.0.0.1:5432/crm_business_schema_test",
		])
			expect(() => validateBusinessSchemaUrl(value)).toThrow(
				"isolated business-schema harness",
			);
		expect(
			validateBusinessSchemaUrl(
				"postgresql://postgres:postgres@127.0.0.1:5432/crm_business_schema_test",
			).hostname,
		).toBe("127.0.0.1");
	});

	it("preserves every legacy deal field without converting or rounding money", async () => {
		expect(
			await rows(
				snapshotRow,
				'SELECT (to_jsonb(d) - \'pipelineStageId\')::text AS snapshot FROM "deal" d ORDER BY "id"',
			),
		).toEqual(dealSnapshot);
	});

	it("preserves null conversion data and exact decimal scale", async () => {
		const monetary = await rows(
			z.object({
				id: z.string(),
				amount: z.string().nullable(),
				baseAmount: z.string().nullable(),
				fxRate: z.string().nullable(),
				currency: z.string(),
				baseCurrency: z.string().nullable(),
			}),
			'SELECT "id", "amount"::text, "baseAmount"::text, "fxRate"::text, "currency", "baseCurrency" FROM "deal" WHERE "id" IN ($1, $2, $3) ORDER BY "id"',
			[
				"legacy-DEMO_BOOKED",
				"legacy-QUALIFIED_TO_BUY",
				"legacy-DECISION_MAKER_BOUGHT_IN",
			],
		);
		expect(monetary).toEqual([
			{
				id: "legacy-DECISION_MAKER_BOUGHT_IN",
				amount: "12345.67",
				baseAmount: "13888.8788",
				fxRate: "1.1250000000",
				currency: "EUR",
				baseCurrency: "USD",
			},
			{
				id: "legacy-DEMO_BOOKED",
				amount: "999999999999.99",
				baseAmount: "999999999999.9900",
				fxRate: "1.0000000000",
				currency: "USD",
				baseCurrency: "USD",
			},
			{
				id: "legacy-QUALIFIED_TO_BUY",
				amount: null,
				baseAmount: null,
				fxRate: null,
				currency: "USD",
				baseCurrency: null,
			},
		]);
	});

	it("maps all seven legacy stages to stable IDs and outcomes", async () => {
		const mapped = await rows(
			z.object({
				id: z.string(),
				stage: z.string(),
				pipelineStageId: z.string(),
				pipelineId: z.string(),
				outcome: z.string(),
				position: z.number().int(),
			}),
			'SELECT d."id", d."stage"::text, d."pipelineStageId", ps."pipelineId", ps."outcome"::text, ps."position" FROM "deal" d JOIN "pipelineStage" ps ON ps."id" = d."pipelineStageId" ORDER BY ps."position"',
		);
		expect(mapped).toEqual(
			stages.map(({ legacy, outcome, position }) => ({
				id: `legacy-${legacy}`,
				stage: legacy,
				pipelineStageId: `stage-${legacy}`,
				pipelineId: "pipeline-default",
				outcome,
				position,
			})),
		);
	});

	it("keeps archived, close, FX and stage dates unchanged to milliseconds", async () => {
		const dates = await rows(
			z.object({
				stageChangedAt: z.string(),
				fxRateAt: z.string(),
				expectedCloseDate: z.string(),
				closedAt: z.string(),
				createdAt: z.string(),
				updatedAt: z.string(),
				archivedAt: z.string(),
			}),
			'SELECT "stageChangedAt"::text, "fxRateAt"::text, "expectedCloseDate"::text, "closedAt"::text, "createdAt"::text, "updatedAt"::text, "archivedAt"::text FROM "deal" WHERE "id" = $1',
			["legacy-UNQUALIFIED_TO_BUY"],
		);
		expect(dates).toEqual([
			{
				stageChangedAt: "2026-08-05 03:04:05.678",
				fxRateAt: "2026-08-06 04:05:06.789",
				expectedCloseDate: "2026-10-31 18:30:45.901",
				closedAt: "2026-09-15 15:16:17.234",
				createdAt: "2026-08-01 12:13:14.345",
				updatedAt: "2026-09-16 17:18:19.456",
				archivedAt: "2026-09-20 19:20:21.678",
			},
		]);
	});

	it("creates one default pipeline and no fabricated transition history", async () => {
		expect(
			await rows(
				z.object({
					id: z.string(),
					isDefault: z.boolean(),
					revision: z.number().int(),
					archivedAt: z.string().nullable(),
				}),
				'SELECT "id", "isDefault", "revision", "archivedAt"::text FROM "pipeline"',
			),
		).toEqual([
			{
				id: "pipeline-default",
				isDefault: true,
				revision: 1,
				archivedAt: null,
			},
		]);
		expect(
			await rows(
				z.object({ count: z.string() }),
				'SELECT count(*)::text FROM "dealStageChange"',
			),
		).toEqual([{ count: "0" }]);
	});

	it("preserves all legacy activity fields and author identities", async () => {
		expect(
			await rows(
				snapshotRow,
				"SELECT (to_jsonb(a) - 'assigneeId' - 'priority')::text AS snapshot FROM \"activity\" a ORDER BY \"id\"",
			),
		).toEqual(activitySnapshot);
	});

	it("backfills pending and completed tasks but leaves other activity types unassigned", async () => {
		const assignments = await rows(
			assignmentRow,
			'SELECT "id", "type"::text, "createdById", "assigneeId", "priority", "completedAt"::text FROM "activity" ORDER BY "id"',
		);
		expect(assignments).toHaveLength(8);
		for (const assignment of assignments) {
			expect(assignment.priority).toBe(0);
			expect(assignment.assigneeId).toBe(
				assignment.type === "TASK" ? assignment.createdById : null,
			);
		}
		expect(
			assignments.find((row) => row.id === "legacy-TASK-completed")
				?.completedAt,
		).toBe("2026-08-24 09:10:11.123");
	});

	it("installs the new indexes, FKs, priority check and stage trigger", async () => {
		const indexes = await rows(
			z.object({ indexname: z.string() }),
			"SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[]) ORDER BY indexname",
			[
				[
					"pipeline_one_default",
					"pipeline_nameKey_key",
					"pipelineStage_pipelineId_nameKey_key",
					"pipelineStage_pipelineId_position_idx",
					"deal_pipelineStageId_idx",
					"dealStageChange_dealId_occurredAt_idx",
					"activity_assigneeId_completedAt_dueAt_idx",
				],
			],
		);
		expect(indexes).toHaveLength(7);
		const constraints = await rows(
			z.object({ conname: z.string() }),
			"SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[]) ORDER BY conname",
			[
				[
					"pipelineStage_pipelineId_fkey",
					"deal_pipelineStageId_fkey",
					"dealStageChange_dealId_fkey",
					"dealStageChange_actorId_fkey",
					"activity_assigneeId_fkey",
					"activity_priority_bounds",
				],
			],
		);
		expect(constraints).toHaveLength(6);
		expect(
			await rows(
				z.object({ tgname: z.string(), enabled: z.string() }),
				"SELECT tgname, tgenabled::text AS enabled FROM pg_trigger WHERE tgname = $1 AND NOT tgisinternal",
				["deal_pipeline_stage_guard"],
			),
		).toEqual([{ tgname: "deal_pipeline_stage_guard", enabled: "O" }]);
	});

	it("maps legacy-only inserts for every outcome through the trigger", async () => {
		for (const stage of stages) {
			await insertDeal(`insert-${stage.legacy}`, stage.legacy);
			expect(
				await rows(
					dealRow,
					'SELECT "id", "stage"::text, "pipelineStageId" FROM "deal" WHERE "id" = $1',
					[`insert-${stage.legacy}`],
				),
			).toEqual([
				{
					id: `insert-${stage.legacy}`,
					stage: stage.legacy,
					pipelineStageId: `stage-${stage.legacy}`,
				},
			]);
		}
	});

	it("uses explicit stage IDs and synchronizes the legacy value", async () => {
		await insertDeal("explicit-won", "DEMO_BOOKED", "stage-CLOSED_WON");
		expect(
			await rows(
				dealRow,
				'SELECT "id", "stage"::text, "pipelineStageId" FROM "deal" WHERE "id" = $1',
				["explicit-won"],
			),
		).toEqual([
			{
				id: "explicit-won",
				stage: "CLOSED_WON",
				pipelineStageId: "stage-CLOSED_WON",
			},
		]);
	});

	it("refuses nonexistent stage IDs on insert and update", async () => {
		await expectSqlError(
			'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "pipelineStageId", "updatedAt") VALUES ($1, $1, $2, $3, $4, CURRENT_TIMESTAMP)',
			["bad-stage", "synthetic-company", "synthetic-author", "missing-stage"],
			"P0001",
			"No valid pipeline stage",
		);
		await expectSqlError(
			'UPDATE "deal" SET "pipelineStageId" = $1 WHERE "id" = $2',
			["missing-stage", "legacy-DEMO_BOOKED"],
			"P0001",
			"No valid pipeline stage",
		);
	});

	it("refuses legacy inserts without an active default pipeline", async () => {
		await query('UPDATE "pipeline" SET "isDefault" = false WHERE "id" = $1', [
			"pipeline-default",
		]);
		await expectSqlError(
			'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "updatedAt") VALUES ($1, $1, $2, $3, CURRENT_TIMESTAMP)',
			["without-default", "synthetic-company", "synthetic-author"],
			"P0001",
			"No valid pipeline stage",
		);
		await insertDeal(
			"explicit-without-default",
			"DEMO_BOOKED",
			"stage-DEMO_BOOKED",
		);
	});

	it("refuses inserting or moving deals to archived stages", async () => {
		await query(
			'UPDATE "pipelineStage" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "id" = $1',
			["stage-CLOSED_WON"],
		);
		await expectSqlError(
			'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "pipelineStageId", "updatedAt") VALUES ($1, $1, $2, $3, $4, CURRENT_TIMESTAMP)',
			[
				"archived-stage",
				"synthetic-company",
				"synthetic-author",
				"stage-CLOSED_WON",
			],
			"P0001",
			"Pipeline stage is archived",
		);
		await expectSqlError(
			'UPDATE "deal" SET "pipelineStageId" = $1 WHERE "id" = $2',
			["stage-CLOSED_WON", "legacy-DEMO_BOOKED"],
			"P0001",
			"Pipeline stage is archived",
		);
		await expectSqlError(
			'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "stage", "updatedAt") VALUES ($1, $1, $2, $3, \'CLOSED_WON\', CURRENT_TIMESTAMP)',
			["legacy-archived-won", "synthetic-company", "synthetic-author"],
			"P0001",
			"No valid pipeline stage",
		);
	});

	it("uses the first active matching outcome when a legacy open stage is archived", async () => {
		await query(
			'UPDATE "pipelineStage" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "id" = $1',
			["stage-DEMO_BOOKED"],
		);
		await insertDeal("fallback-open");
		expect(
			await rows(
				dealRow,
				'SELECT "id", "stage"::text, "pipelineStageId" FROM "deal" WHERE "id" = $1',
				["fallback-open"],
			),
		).toEqual([
			{
				id: "fallback-open",
				stage: "QUALIFIED_TO_BUY",
				pipelineStageId: "stage-QUALIFIED_TO_BUY",
			},
		]);
	});

	it("refuses archived pipelines even when their stages remain active", async () => {
		await query(
			'UPDATE "pipeline" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "id" = $1',
			["pipeline-default"],
		);
		await expectSqlError(
			'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "pipelineStageId", "updatedAt") VALUES ($1, $1, $2, $3, $4, CURRENT_TIMESTAMP)',
			[
				"archived-pipeline",
				"synthetic-company",
				"synthetic-author",
				"stage-DEMO_BOOKED",
			],
			"P0001",
			"Pipeline stage is archived",
		);
		await expectSqlError(
			'UPDATE "deal" SET "pipelineStageId" = $1 WHERE "id" = $2',
			["stage-CLOSED_WON", "legacy-DEMO_BOOKED"],
			"P0001",
			"Pipeline stage is archived",
		);
		await expectSqlError(
			'INSERT INTO "deal" ("id", "name", "companyId", "ownerId", "updatedAt") VALUES ($1, $1, $2, $3, CURRENT_TIMESTAMP)',
			["legacy-archived-pipeline", "synthetic-company", "synthetic-author"],
			"P0001",
			"No valid pipeline stage",
		);
	});

	it("keeps existing archived-stage records editable without changing their stage", async () => {
		await query(
			'UPDATE "pipelineStage" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "id" = $1',
			["stage-DEMO_BOOKED"],
		);
		await query(
			'UPDATE "pipeline" SET "archivedAt" = CURRENT_TIMESTAMP WHERE "id" = $1',
			["pipeline-default"],
		);
		await query(
			'UPDATE "deal" SET "name" = $1, "pipelineStageId" = "pipelineStageId", "stage" = "stage" WHERE "id" = $2',
			["Edición histórica ficticia", "legacy-DEMO_BOOKED"],
		);
		expect(
			await rows(
				z.object({ name: z.string(), pipelineStageId: z.string() }),
				'SELECT "name", "pipelineStageId" FROM "deal" WHERE "id" = $1',
				["legacy-DEMO_BOOKED"],
			),
		).toEqual([
			{
				name: "Edición histórica ficticia",
				pipelineStageId: "stage-DEMO_BOOKED",
			},
		]);
	});

	it("rejects legacy-only stage updates without corrupting the existing mapping", async () => {
		await expectSqlError(
			'UPDATE "deal" SET "stage" = \'CLOSED_WON\' WHERE "id" = $1',
			["legacy-DEMO_BOOKED"],
			"P0001",
			"Change pipelineStageId instead of the legacy stage",
		);
		await expectSqlError(
			'UPDATE "deal" SET "stage" = \'CLOSED_LOST\', "pipelineStageId" = "pipelineStageId" WHERE "id" = $1',
			["legacy-DEMO_BOOKED"],
			"P0001",
			"Change pipelineStageId instead of the legacy stage",
		);
		expect(
			await rows(
				dealRow,
				'SELECT "id", "stage"::text, "pipelineStageId" FROM "deal" WHERE "id" = $1',
				["legacy-DEMO_BOOKED"],
			),
		).toEqual([
			{
				id: "legacy-DEMO_BOOKED",
				stage: "DEMO_BOOKED",
				pipelineStageId: "stage-DEMO_BOOKED",
			},
		]);
	});

	it("synchronizes valid ID transitions and never leaves a null stage mapping", async () => {
		await query(
			'UPDATE "deal" SET "pipelineStageId" = $1, "stage" = \'DEMO_BOOKED\' WHERE "id" = $2',
			["stage-CLOSED_WON", "legacy-DEMO_BOOKED"],
		);
		expect(
			await rows(
				dealRow,
				'SELECT "id", "stage"::text, "pipelineStageId" FROM "deal" WHERE "id" = $1',
				["legacy-DEMO_BOOKED"],
			),
		).toEqual([
			{
				id: "legacy-DEMO_BOOKED",
				stage: "CLOSED_WON",
				pipelineStageId: "stage-CLOSED_WON",
			},
		]);
		await query('UPDATE "deal" SET "pipelineStageId" = NULL WHERE "id" = $1', [
			"legacy-DEMO_BOOKED",
		]);
		expect(
			await rows(
				dealRow,
				'SELECT "id", "stage"::text, "pipelineStageId" FROM "deal" WHERE "id" = $1',
				["legacy-DEMO_BOOKED"],
			),
		).toEqual([
			{
				id: "legacy-DEMO_BOOKED",
				stage: "CLOSED_WON",
				pipelineStageId: "stage-CLOSED_WON",
			},
		]);
	});

	it("supports explicit custom pipelines and preserves their legacy compatibility", async () => {
		await insertPipeline("synthetic-pipeline");
		await insertStage(
			"synthetic-stage",
			"synthetic-pipeline",
			"CONTRACT_SENT",
			"OPEN",
		);
		await insertDeal("custom-pipeline", "DEMO_BOOKED", "synthetic-stage");
		expect(
			await rows(
				dealRow,
				'SELECT "id", "stage"::text, "pipelineStageId" FROM "deal" WHERE "id" = $1',
				["custom-pipeline"],
			),
		).toEqual([
			{
				id: "custom-pipeline",
				stage: "CONTRACT_SENT",
				pipelineStageId: "synthetic-stage",
			},
		]);
	});

	it("restricts deleting referenced stages and pipelines", async () => {
		await expectSqlError(
			'DELETE FROM "pipelineStage" WHERE "id" = $1',
			["stage-CLOSED_WON"],
			"23503",
			"deal_pipelineStageId_fkey",
		);
		await expectSqlError(
			'DELETE FROM "pipeline" WHERE "id" = $1',
			["pipeline-default"],
			"23503",
			"pipelineStage_pipelineId_fkey",
		);
	});

	it("enforces one default pipeline and unique pipeline names", async () => {
		await expectSqlError(
			'INSERT INTO "pipeline" ("id", "name", "nameKey", "isDefault", "updatedAt") VALUES ($1, $1, $1, true, CURRENT_TIMESTAMP)',
			["second-default"],
			"23505",
			"pipeline_one_default",
		);
		await expectSqlError(
			'INSERT INTO "pipeline" ("id", "name", "nameKey", "updatedAt") VALUES ($1, $1, $2, CURRENT_TIMESTAMP)',
			["duplicate-name", "proceso comercial inicial"],
			"23505",
			"pipeline_nameKey_key",
		);
	});

	it("enforces stage names within a pipeline and stage parent FKs", async () => {
		await expectSqlError(
			'INSERT INTO "pipelineStage" ("id", "pipelineId", "name", "nameKey", "position", "outcome", "legacyStage") VALUES ($1, $2, $1, $3, 20, \'OPEN\', \'CONTRACT_SENT\')',
			["duplicate-stage", "pipeline-default", "propuesta"],
			"23505",
			"pipelineStage_pipelineId_nameKey_key",
		);
		await expectSqlError(
			'INSERT INTO "pipelineStage" ("id", "pipelineId", "name", "nameKey", "position", "outcome", "legacyStage") VALUES ($1, $2, $1, $1, 20, \'OPEN\', \'CONTRACT_SENT\')',
			["dangling-stage", "missing-pipeline"],
			"23503",
			"pipelineStage_pipelineId_fkey",
		);
		await insertPipeline("other-pipeline");
		await query(
			'INSERT INTO "pipelineStage" ("id", "pipelineId", "name", "nameKey", "position", "outcome", "legacyStage") VALUES ($1, $2, $1, $3, 20, \'OPEN\', \'CONTRACT_SENT\')',
			["other-proposal", "other-pipeline", "propuesta"],
		);
	});

	it("enforces transition-history deal and actor foreign keys", async () => {
		await expectSqlError(
			'INSERT INTO "dealStageChange" ("id", "dealId", "actorId", "toStageId", "toStageName", "toOutcome", "toPipelineId", "toPipelineName") VALUES ($1, $2, $3, $4, $4, \'WON\', $5, $5)',
			[
				"missing-deal-history",
				"missing-deal",
				"synthetic-author",
				"stage-CLOSED_WON",
				"pipeline-default",
			],
			"23503",
			"dealStageChange_dealId_fkey",
		);
		await expectSqlError(
			'INSERT INTO "dealStageChange" ("id", "dealId", "actorId", "toStageId", "toStageName", "toOutcome", "toPipelineId", "toPipelineName") VALUES ($1, $2, $3, $4, $4, \'WON\', $5, $5)',
			[
				"missing-actor-history",
				"legacy-CLOSED_WON",
				"missing-actor",
				"stage-CLOSED_WON",
				"pipeline-default",
			],
			"23503",
			"dealStageChange_actorId_fkey",
		);
	});

	it("preserves transition snapshots after stage changes and cascades only with the deal", async () => {
		await insertHistory("synthetic-history");
		const before = await rows(
			snapshotRow,
			'SELECT to_jsonb(h)::text AS snapshot FROM "dealStageChange" h WHERE "id" = $1',
			["synthetic-history"],
		);
		await query('UPDATE "pipelineStage" SET "name" = $1 WHERE "id" = $2', [
			"Nombre nuevo",
			"stage-CLOSED_WON",
		]);
		await query('UPDATE "deal" SET "pipelineStageId" = $1 WHERE "id" = $2', [
			"stage-CLOSED_LOST",
			"legacy-CLOSED_WON",
		]);
		await query('DELETE FROM "pipelineStage" WHERE "id" = $1', [
			"stage-CLOSED_WON",
		]);
		expect(
			await rows(
				snapshotRow,
				'SELECT to_jsonb(h)::text AS snapshot FROM "dealStageChange" h WHERE "id" = $1',
				["synthetic-history"],
			),
		).toEqual(before);
		await query('DELETE FROM "deal" WHERE "id" = $1', ["legacy-CLOSED_WON"]);
		expect(
			await rows(
				z.object({ count: z.string() }),
				'SELECT count(*)::text FROM "dealStageChange" WHERE "id" = $1',
				["synthetic-history"],
			),
		).toEqual([{ count: "0" }]);
	});

	it("restricts deletion of actors referenced only by transition history", async () => {
		await query(
			'INSERT INTO "user" ("id", "name", "email", "updatedAt") VALUES ($1, $1, $2, CURRENT_TIMESTAMP)',
			["history-only-actor", "history@example.test"],
		);
		await insertHistory(
			"actor-history",
			"legacy-CLOSED_WON",
			"history-only-actor",
		);
		await expectSqlError(
			'DELETE FROM "user" WHERE "id" = $1',
			["history-only-actor"],
			"23503",
			"dealStageChange_actorId_fkey",
		);
	});

	it("allows all four task priorities and rejects out-of-range inserts and updates", async () => {
		for (const priority of [0, 1, 2, 3]) {
			await query('UPDATE "activity" SET "priority" = $1 WHERE "id" = $2', [
				priority,
				"legacy-TASK",
			]);
			expect(
				await rows(
					z.object({ priority: z.number().int() }),
					'SELECT "priority" FROM "activity" WHERE "id" = $1',
					["legacy-TASK"],
				),
			).toEqual([{ priority }]);
		}
		for (const priority of [-1, 4]) {
			await expectSqlError(
				'UPDATE "activity" SET "priority" = $1 WHERE "id" = $2',
				[priority, "legacy-TASK"],
				"23514",
				"activity_priority_bounds",
			);
			await expectSqlError(
				'INSERT INTO "activity" ("id", "type", "createdById", "priority", "updatedAt") VALUES ($1, \'TASK\', $2, $3, CURRENT_TIMESTAMP)',
				[`bad-priority-${priority}`, "synthetic-author", priority],
				"23514",
				"activity_priority_bounds",
			);
		}
	});

	it("rejects dangling assignees on insert and update", async () => {
		await expectSqlError(
			'UPDATE "activity" SET "assigneeId" = $1 WHERE "id" = $2',
			["missing-user", "legacy-TASK"],
			"23503",
			"activity_assigneeId_fkey",
		);
		await expectSqlError(
			'INSERT INTO "activity" ("id", "type", "createdById", "assigneeId", "updatedAt") VALUES ($1, \'TASK\', $2, $3, CURRENT_TIMESTAMP)',
			["bad-assignee", "synthetic-author", "missing-user"],
			"23503",
			"activity_assigneeId_fkey",
		);
	});

	it("reassigns and unassigns tasks without changing their creator or dates", async () => {
		await query(
			'UPDATE "activity" SET "assigneeId" = $1, "priority" = 3 WHERE "id" = $2',
			["synthetic-assignee", "legacy-TASK"],
		);
		expect(
			await rows(
				assignmentRow,
				'SELECT "id", "type"::text, "createdById", "assigneeId", "priority", "completedAt"::text FROM "activity" WHERE "id" = $1',
				["legacy-TASK"],
			),
		).toEqual([
			{
				id: "legacy-TASK",
				type: "TASK",
				createdById: "synthetic-author",
				assigneeId: "synthetic-assignee",
				priority: 3,
				completedAt: null,
			},
		]);
		expect(
			await rows(
				snapshotRow,
				"SELECT (to_jsonb(a) - 'assigneeId' - 'priority')::text AS snapshot FROM \"activity\" a ORDER BY \"id\"",
			),
		).toEqual(activitySnapshot);
		await query('UPDATE "activity" SET "assigneeId" = NULL WHERE "id" = $1', [
			"legacy-TASK",
		]);
		expect(
			await rows(
				assignmentRow,
				'SELECT "id", "type"::text, "createdById", "assigneeId", "priority", "completedAt"::text FROM "activity" WHERE "id" = $1',
				["legacy-TASK"],
			),
		).toEqual([
			{
				id: "legacy-TASK",
				type: "TASK",
				createdById: "synthetic-author",
				assigneeId: null,
				priority: 3,
				completedAt: null,
			},
		]);
	});

	it("sets a deleted assignee to null while preserving the author", async () => {
		await query(
			'INSERT INTO "user" ("id", "name", "email", "updatedAt") VALUES ($1, $1, $2, CURRENT_TIMESTAMP)',
			["assignment-only-user", "assignment@example.test"],
		);
		await query('UPDATE "activity" SET "assigneeId" = $1 WHERE "id" = $2', [
			"assignment-only-user",
			"legacy-TASK",
		]);
		await query('DELETE FROM "user" WHERE "id" = $1', ["assignment-only-user"]);
		expect(
			await rows(
				z.object({
					createdById: z.string(),
					assigneeId: z.string().nullable(),
				}),
				'SELECT "createdById", "assigneeId" FROM "activity" WHERE "id" = $1',
				["legacy-TASK"],
			),
		).toEqual([{ createdById: "synthetic-author", assigneeId: null }]);
	});

	it("keeps author deletion restricted after task reassignment", async () => {
		await query(
			'INSERT INTO "user" ("id", "name", "email", "updatedAt") VALUES ($1, $1, $2, CURRENT_TIMESTAMP)',
			["activity-only-author", "activity-author@example.test"],
		);
		await query(
			'INSERT INTO "activity" ("id", "type", "createdById", "assigneeId", "updatedAt") VALUES ($1, \'TASK\', $2, $3, CURRENT_TIMESTAMP)',
			["author-restriction", "activity-only-author", "synthetic-assignee"],
		);
		await expectSqlError(
			'DELETE FROM "user" WHERE "id" = $1',
			["activity-only-author"],
			"23503",
			"activity_createdById_fkey",
		);
	});

	it("cascades assignee ID changes without conflating author and responsible user", async () => {
		await query(
			'INSERT INTO "user" ("id", "name", "email", "updatedAt") VALUES ($1, $1, $2, CURRENT_TIMESTAMP)',
			["cascade-assignee", "cascade@example.test"],
		);
		await query('UPDATE "activity" SET "assigneeId" = $1 WHERE "id" = $2', [
			"cascade-assignee",
			"legacy-TASK",
		]);
		await query('UPDATE "user" SET "id" = $1 WHERE "id" = $2', [
			"cascade-assignee-renamed",
			"cascade-assignee",
		]);
		expect(
			await rows(
				z.object({ createdById: z.string(), assigneeId: z.string() }),
				'SELECT "createdById", "assigneeId" FROM "activity" WHERE "id" = $1',
				["legacy-TASK"],
			),
		).toEqual([
			{
				createdById: "synthetic-author",
				assigneeId: "cascade-assignee-renamed",
			},
		]);
	});
} else {
	it.skip("business schema integration requires its disposable loopback harness", () => {});
}
