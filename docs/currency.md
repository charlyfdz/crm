# Currency — read when touching deal amounts, totals, or rates


Two amounts, and only one is ever summed. (`_sum: { amount: true }` once added euros
to dollars and printed `$2.0M`, silently.)

- **`amount` + `currency`** is what the customer pays. Never converted in place.
- **`baseAmount` is the only column any total, chart, average or sort may touch**;
  `fxRate`/`fxRateAt` record how it got there.
- **`baseCurrency` says what `baseAmount` is denominated in** — without it a figure
  converted against a stale base is indistinguishable from a correct one.
  - **`countedWhere(base)` filters every money aggregate.** Counts are deliberately
    *not* filtered, so stage groups read counts and sums from separate queries.
  - **`pendingWhere(base)`** = null `baseAmount` *or* wrong `baseCurrency`, and it
    **matches null explicitly** — `{ not: base }` is `NULL`, not true, for a null
    column, so such rows were invisible everywhere.
  - **Compose with `AND`, never spread** — it contains an `OR`, and so does the deals
    list's own `where`.
  - **Every writer of `baseAmount` writes `baseCurrency` in the same statement**:
    `ConversionService` and `prisma/seed.ts`.
- **The rate is resolved once and frozen.** `create`/`update` call
  `ConversionService.dealFields` when `amount` *or* `currency` changes, reading the
  unchanged one back in the same call. Converting on read makes a closed quarter change
  value every morning.
- **A missing rate is a null, disclosed not zeroed** — it falls out of `_sum`
  automatically, and `unconverted` counts those rows so the UI can say *3 deals in CHF
  are not included*.
- **`fillMissing()` never touches a converted deal**; `rerateAll()` is the only thing
  that overwrites a frozen rate, and only on a reporting-currency change.

**`ExchangeRate.rate` = units of `baseCurrency` per unit of `quoteCurrency`**, so
`baseAmount = amount × rate` everywhere. The feed quotes the other way; `RatesService`
inverts on ingest.

- **`MANUAL` beats `FETCHED`** (unique on `(base, quote, source)`), which makes the
  fetcher optional — Settings → Currencies is the manual path. `resolveRate` refuses a
  rate ≤ 0.
- **Re-rating deduplicates codes through a `Set`** — `currency` was free text, so
  ` usd ` and `USD` were two groups each updating every variant.
- **`MAX_AMOUNT_CENTS`** (`@crm/validation/deal-money`) is what `Decimal(14, 2)` holds;
  `baseAmount` is `Decimal(24, 4)` so amount × rate still fits.
- **Reporting currency is `AppSetting.reportingCurrency`**, read only through
  `readReportingCurrency`.
- **Codes are validated against `isCurrencyCode` (`@crm/db/currency`), not a regex** —
  `z.string().length(3)` accepted `ZZZ`. `isWellFormedCurrency` is separate because
  `Intl` throws on non-three-letter input.
- **`CURRENCIES` contains twelve supported currencies** — USD, EUR,
  JPY, GBP, CNY, AUD, CAD, CHF, HKD, SGD, ZAR, MXN, in array order. `isCurrencyCode` is the
  single gate for the picker, the feed filter and the stored setting. A refresh
  **prunes** `FETCHED` rows outside the list and leaves `MANUAL` alone.
- **`applyRate` rounds to the *reporting* currency's `minorUnitsOf`**, not to two. The
  ×100 cents transport cannot represent a three-decimal minor unit; nor can
  `Decimal(14, 2)`.

**Feed: `open.er-api.com`, keyless**, two attempts at 6s. **Check `result`, not just
the status** — an unsupported base returns HTTP 200 with `{"result":"error"}`. An
unreachable provider warns and returns `{ ok: false }`; only the interactive refresh
throws.

**The fetcher is in the API deliberately**: a daily rate decides nothing, and
`DealsService` needs it *synchronously* to write `baseAmount` in the same transaction.
Any judgement about it belongs in `apps/agent`.

`POST /internal/sync/rates` is guarded by `CRON_SECRET` (`timingSafeEquals`) and
**fails closed when unset**. **A route is not a schedule** — add it to
`apps/api/vercel.json` in the same change or nothing runs it.

## MXN and dashboard reports — 2026-10-02

MXN uses two minor units. Its name is `Mexican Peso`.
The catalog preserves the existing currencies and appends MXN.
The installation fallback remains USD. This change assigns no reporting currency to Corporativo S&F.
An operator selects the reporting currency explicitly. Missing foreign rates remain missing.
Only identical source and reporting currencies use the identity rate of one.
Test rates are synthetic fixtures. They are not exchange-rate advice or operational settings.

The dashboard reads the reporting currency once for each summary.
Every opportunity query excludes rows with a non-null `archivedAt`.
Scope `me` filters opportunities by `ownerId`. Scope `everyone` includes all active opportunities.
Money aggregates also apply `countedWhere(base)`. Counts include opportunities without a valid conversion.
The current-month closing count and amount use separate queries.
The missing-conversion disclosure uses `pendingWhere(base)` across all active opportunities in the selected ownership scope.
It includes closed opportunities and older opportunities. It is not an open-pipeline count.
Rows without an original amount stay counted, but they are not missing-rate records.

The largest-open list selects current-base values before applying its six-record limit.
Unvalued rows fill remaining places. Their reporting amounts stay null.
Unvalued rows never displace a valued row, including a measured zero.
The list uses expected-close dates and record IDs to break ties.
Archive and restore remove and reinstate reporting participation. They do not change stored amounts or frozen rates.
Archived opportunities also leave the dashboard's task and activity lists.
Unlinked activities remain available.

Scope `me` selects overdue tasks through `assigneeId`, not `createdById`.
Tasks created by another person appear when assigned to the acting user.
Scope `everyone` includes all overdue tasks, including unassigned tasks.
Recent activity retains its author-based scope.

`Deal.stage` remains the legacy reporting classification.
The dashboard does not group by configurable stage names or `pipelineStageId`.
Won and lost decisions determine the win-rate denominator. Disqualified decisions stay outside that denominator.
The trend uses six calendar months in the API process timezone.
The performance window uses ninety elapsed days. Future creation and closure timestamps do not enter those historical metrics.

The query ledger, synthetic calculations, commands, and limits are in [reporting verification](data/reporting-20261002.md).

## Input and presentation integration — 2026-10-02

Both opportunity creation forms use `parseDealAmount` from `@crm/validation/deal-money`.
Empty input stays null. Zero stays a measured zero.
The parser accepts decimal amounts with at most two fraction digits.
It rejects negative amounts, separators, scientific notation, suffixes, and values above the storage limit.
It computes cents with integer arithmetic. It does not round invalid input into a valid amount.

Shared record money and dashboard money use an explicit `en-US` locale.
Server and browser defaults do not change their rendered text.
This locale prevents the reported currency-text difference. It does not select the company's locale or timezone.

Empty chart labels describe the available positive amounts, not an invented absence of opportunities.
The pipeline label includes the opportunity count when no positive slice exists.
Conversion notices cover null and stale bases. They do not claim every exclusion lacks a rate.
The chart explicitly describes legacy result classifications, not configurable stage names.

The [integrated business receipt](verification/2026-10-02-business-flow.md) records the current checks and remaining limits.

