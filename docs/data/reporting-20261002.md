# Reporting and MXN verification — 2026-10-02

Status: Share with caveats within the tested service scope.
This receipt covers MXN metadata and dashboard query behavior.
It does not establish production readiness, deployment approval, or company process acceptance.

## Boundaries

The work changes only these files:

- `packages/db/src/currency.ts`
- `packages/db/test/currency.spec.ts`
- `apps/api/src/dashboard/dashboard-config.ts`
- `apps/api/src/dashboard/dashboard.service.ts`
- `apps/api/test/dashboard-summary.spec.ts`
- `docs/currency.md`
- `docs/data/reporting-20261002.md`

Existing checkout changes remain intact. No schema, generated file, DealStage value, or DealsService changes belong to this work.
No environment file, real data, real account, external service, remote write, or deployment participates.

Read instructions: `AGENTS.md`, `docs/api.md`, and `docs/currency.md`.
Read skills: NestJS best practices, NestJS-tRPC, GitNexus debugging, and Data validate-data.
Validation separates population, units, counts, and money eligibility.
The GitNexus inventory contains 28 repositories and no index for this CRM.
Direct source reads supply the code evidence. No index refresh occurs.
The knowledge-engine context identifies the CRM as a local development project.
Its global check reports code 2 and stale documentary sources.
Local source and test results govern this receipt. No external snapshot refresh or knowledge-engine write occurs.

## Changes

MXN joins the catalog once, after the existing eleven currencies.
MXN uses two minor units. The fallback remains USD.
No S&F setting or exchange-rate record changes.
The only new foreign rate is an in-memory, explicitly synthetic test fixture.

The dashboard captures one reporting currency for each summary.
Its money queries sum only matching, non-null `baseAmount` values.
Its count queries include opportunities without a conversion.
Archived opportunities leave every dashboard opportunity population.
Archive and restore simulations change only fixture `archivedAt` values.

The largest-open list queries valued and unvalued populations separately.
Both lists apply their filters before `take`.
Valued rows occupy the first places. Unvalued rows fill remaining places with null reporting amounts.
Measured zero remains a valued amount.

Scope `me` selects overdue tasks by assignee.
A task created by OTHER and assigned to OWNER appears for OWNER.
A task created by OWNER and assigned to OTHER stays outside OWNER's overdue list.
Scope `everyone` includes every overdue task, including unassigned tasks.
Recent activity stays scoped by author.
Tasks and activities linked to archived opportunities leave both dashboard lists.
Unlinked activities remain available.

## Query ledger

`active` means `archivedAt = null` with the selected ownership scope.
`open` adds the existing `OPEN_DEAL_STAGES` classification.
`counted` means non-null `baseAmount` and matching `baseCurrency`.
`pending` means a priced opportunity with missing `baseAmount`, missing `baseCurrency`, or a different reporting currency.

| Read | Population | Money or count rule |
| --- | --- | --- |
| `deal.groupBy(stage)` | active, open | Count all eligible rows. |
| `deal.groupBy(stage)` | active, open, counted | Sum only `baseAmount`. |
| `deal.findMany` trend | active, created or closed within trend bounds | Count decisions independently; value only matching bases. |
| `deal.aggregate` closing | active, open, current expected-close month, counted | Sum only `baseAmount`. |
| `deal.count` closing | active, open, current expected-close month | Do not require conversion. |
| `deal.findMany` largest valued | active, open, counted | Sort known amounts before applying six-row limit. |
| `deal.findMany` largest unvalued | active, open, explicit null-or-wrong-base predicate | Fill remaining slots with null reporting amounts. |
| `activity.findMany` overdue | task, incomplete, due before now, no linked opportunity or active linked opportunity | `me` uses assignee; `everyone` has no assignee restriction. |
| `activity.findMany` recent | no linked opportunity or active linked opportunity | `me` uses author; `everyone` has no author restriction. |
| `deal.groupBy(currency)` pending | active, pending | Count every eligible row; normalize and deduplicate currency labels. |

There are ten dashboard data reads and one reporting-setting read.
The test harness checks every read, including required archive predicates and the supported filter operators.
The harness rejects unknown predicates. It models explicit null checks and SQL-style nullable string inequality.
It implements only the query subset used here. It is not a Prisma emulator.

The disclosure population spans all active opportunities, including closed and older opportunities.
The open pipeline, monthly totals, and performance window have different documented populations.
Their counts are not interchangeable denominators.

## Independent synthetic arithmetic

The fixed test date is October 2, 2026, at noon in the test process timezone.
Fixture domains use `example.test`. All people, companies, opportunities, and stage IDs are synthetic.
Original amounts deliberately differ from reporting amounts. The dashboard never adds those original amounts.

| Selected population | Expected result |
| --- | --- |
| OWNER open opportunities | 8 opportunities; MXN 300.00 counted value. |
| OWNER open stage values | MXN 100.00 + MXN 200.00 + MXN 0.00 + MXN 0.00. |
| OWNER closing this month | 8 opportunities; MXN 300.00 counted value. |
| OWNER missing conversions | 5 priced opportunities; CHF, MXN, USD labels. |
| OWNER wins this month | 2 wins; MXN 1,000.00 from one valued win. |
| OWNER previous-month wins | 1 win; MXN 400.00. |
| OWNER ninety-day decisions | 3 wins, 1 loss; win rate 3 / 4 = 0.75. |
| OWNER valued-win average | (MXN 1,000.00 + MXN 400.00) / 2 = MXN 700.00. |
| OWNER cycle average | (21 + 21 + 5) / 3 rounds to 16 days. |
| OWNER September created value | MXN 300.00 + MXN 1,000.00 + MXN 400.00 + MXN 100.00 = MXN 1,800.00. |
| Everyone open opportunities | 10 opportunities; MXN 600.00 counted value. |
| OWNER after archiving the MXN 100.00 opportunity | 7 open opportunities; MXN 200.00. |
| OWNER after restoring that opportunity | Exact equality with the original summary. |
| OWNER after archiving an unconverted win | Win count falls to 1; this-month money stays MXN 1,000.00. |

Other cases cover empty and all-unconverted populations, measured zero, stale high values, ties, decimals, and reporting-currency changes.
Month boundaries include the start and exclude the next month.
The ninety-day boundary includes its first instant and excludes future decisions.
Custom OPEN stages retain the existing legacy open classification.
WON, LOST, and DISQUALIFIED fixtures preserve their legacy classification.
DISQUALIFIED stays outside the win-rate denominator.
These fixtures do not prove pipeline-writer consistency or task-assignment authorization.

## Commands and results

Run each test file in a separate process.
The dashboard test mocks the `@crm/db` barrel with generated Decimal and enum exports.
No real Prisma client, database connection, or environment loader participates in that test.
Its fetch mock rejects network calls. Each case also asserts zero fetch calls.

From the repository root:

```powershell
bun --no-env-file test packages/db/test/currency.spec.ts
```

Result: 23 pass, 0 fail, 77 assertions.

From `apps/api`:

```powershell
bun --no-env-file test test/dashboard-summary.spec.ts
```

Result: 21 pass, 0 fail, 9,264 assertions.
The assertions include repeated predicate checks; they are not independent business acceptance scenarios.
Combined test count: 44 pass, 0 fail across two isolated runs.

From the repository root:

```powershell
bun --no-env-file run node_modules/@biomejs/biome/bin/biome check --write packages/db/src/currency.ts packages/db/test/currency.spec.ts apps/api/src/dashboard/dashboard-config.ts apps/api/src/dashboard/dashboard.service.ts apps/api/test/dashboard-summary.spec.ts
```

Result: 5 files checked, 4 files formatted, exit 0.

The final non-writing Biome run checks the same five files and exits 0 without diagnostics.
The scoped `git diff --check` also exits 0.
Git reports LF-to-CRLF notices. Those notices are not whitespace errors.
The code-comment scan finds no comment lines in the five changed source and test files.

From `packages/db`:

```powershell
bun --no-env-file run check-types
```

Result: exit 0.

From `apps/api`:

```powershell
bun --no-env-file run check-types
```

Result: exit 1 on the latest recorded run.
Only two errors remain, both in `src/pipelines/pipelines.service.ts`, at lines 112 and 223.
The readonly `stages.orderBy` array conflicts with Prisma's mutable array type.
No dashboard, currency, or dashboard-test diagnostics remain.
This work does not edit the pipeline file.

## Issues históricos del especialista

1. BROKEN — API typechecking reports two pipeline selection errors outside this work's scope.
   Fix: the pipeline owner repairs `PIPELINE_SELECT.stages.orderBy` and reruns API typechecking.
2. NOT DONE — PostgreSQL integration, HTTP authorization, pipeline writes, assignment authorization, and browser rendering are not tested here.
   Fix: run isolated integration and rendered tests after specialist changes merge locally.
3. RISK — Parallel reads do not provide a transaction-wide snapshot during concurrent edits.
   Fix: evaluate snapshot isolation with real PostgreSQL and representative concurrent writes.
4. RISK — Calendar boundaries use the API process timezone, not a stored company timezone.
   Fix: confirm the reporting timezone before company acceptance.
5. BROKEN — Frontend copy describes every missing conversion as a missing rate and labels zero-value pipeline charts as empty.
   Fix: the frontend owner distinguishes stale bases, absent prices, zero values, and empty opportunity populations.
6. RISK — JavaScript-number transport does not establish exactness for amounts beyond safe integer precision.
   Fix: validate aggregate limits and select an exact transport before accepting extreme monetary values.
7. NOT DONE — The complete API suite does not run with this isolated module-mock receipt.
   Fix: preserve per-file process isolation when combining dashboard and real-database test workflows.
8. NOT DONE — The knowledge engine's global check reports code 2; documentary freshness remains incomplete.
   Fix: the main coordinator renews authorized sources separately. This specialist does not write outside the assigned scope.

## Integración principal posterior — 2026-10-02

El [recibo integrado](../verification/2026-10-02-business-flow.md) registra una nueva ejecución del árbol compartido.
API TypeScript, app TypeScript y builds finales pasan.
La selección Prisma deja de usar el array readonly incompatible. El problema histórico 1 queda corregido.
Los avisos de conversiones y gráficos dejan de confundir valor desconocido, cero y ausencia de oportunidades.
El problema histórico 5 queda corregido en renderizadores y helpers probados.
Las siete pruebas monetarias y de presentación incluyen defaults servidor `es-MX` y navegador `es-ES`.
Estas pruebas no sustituyen aceptación de navegador.
Las pruebas de Prisma, migraciones y tareas amplían la evidencia focal del problema histórico 2.
No acreditan PostgreSQL 17 ni autorización HTTP empresarial completa.

## Issues

1. NOT DONE — PostgreSQL 17, navegador y autorización HTTP empresarial completa siguen sin aceptación integrada.
   Fix: ejecutar los escenarios aislados del recibo principal.
2. RISK — Lecturas paralelas no comparten snapshot transaccional durante escrituras concurrentes.
   Fix: validar aislamiento con PostgreSQL real y una carga sintética.
3. RISK — Límites de calendario usan timezone del proceso API, no la zona empresarial confirmada.
   Fix: completar configuración de empresa y pruebas de fronteras temporales.
4. RISK — Transporte numérico no acredita exactitud de agregados extremos.
   Fix: definir límites y transporte exacto antes de aceptar importes extremos.
5. NOT DONE — Suite completa y actualización externa del motor siguen pendientes.
   Fix: conservar aislamiento entre mocks y Prisma. Renovar sólo fuentes externas autorizadas.
