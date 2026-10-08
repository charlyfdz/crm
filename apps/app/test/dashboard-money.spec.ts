import { describe, expect, it } from "bun:test";
import { formatMoney, formatMoneyCompact } from "@crm/ui/lib/format";
import {
	formatDashboardMoney,
	formatDashboardMoneyCompact,
} from "../lib/dashboard-money";
import {
	EMPTY_TREND_LABEL,
	emptyPipelineLabel,
	unconvertedLabel,
} from "../lib/dashboard-presentation";

function withDefaultLocale<T>(locale: string, render: () => T): T {
	const nativeNumberFormat = Intl.NumberFormat;
	Object.defineProperty(Intl, "NumberFormat", {
		configurable: true,
		writable: true,
		value: class extends nativeNumberFormat {
			constructor(
				locales?: Intl.LocalesArgument,
				options?: Intl.NumberFormatOptions,
			) {
				super(locales ?? locale, options);
			}
		},
	});

	try {
		return render();
	} finally {
		Intl.NumberFormat = nativeNumberFormat;
	}
}

describe("dashboard money", () => {
	it("renders the same text with different server and browser locales", () => {
		const amounts = [0, 125, -125, 123_456, 123_456_789];
		const currencies = ["USD", "EUR", "JPY", "GBP", "CAD", "MXN"];
		const render = () =>
			currencies.flatMap((currency) =>
				amounts.flatMap((cents) => [
					formatDashboardMoney(cents, currency),
					formatDashboardMoneyCompact(cents, currency),
				]),
			);

		const server = withDefaultLocale("es-MX", render);
		const browser = withDefaultLocale("es-ES", render);

		expect(browser).toEqual(server);
		expect(server[0]).toBe("USD 0");
		expect(server[1]).toBe("USD 0");
	});

	it("keeps shared record money stable across server and browser locales", () => {
		const render = () =>
			["USD", "MXN", "EUR", "JPY"].flatMap((currency) =>
				[0, 125, 123_456, 123_456_789].flatMap((cents) => [
					formatMoney(cents, currency),
					formatMoneyCompact(cents, currency),
				]),
			);
		expect(withDefaultLocale("es-MX", render)).toEqual(
			withDefaultLocale("es-ES", render),
		);
	});

	it("distinguishes no opportunities from amounts that do not make chart slices", () => {
		expect(emptyPipelineLabel(0)).toBe("No hay oportunidades abiertas");
		expect(emptyPipelineLabel(3)).toBe(
			"3 oportunidades abiertas; sin importe positivo para graficar",
		);
		expect(EMPTY_TREND_LABEL).toBe(
			"No hay importes positivos para graficar en este período",
		);
	});

	it("does not claim every excluded amount lacks an exchange rate", () => {
		expect(unconvertedLabel(1, ["MXN"])).toBe(
			"1 oportunidad en MXN sin conversión válida. Sus importes no se incluyen.",
		);
		expect(unconvertedLabel(2, ["MXN", "USD"])).toBe(
			"2 oportunidades en MXN, USD sin conversión válida. Sus importes no se incluyen.",
		);
	});

	it("keeps cents, grouping and the reporting currency explicit", () => {
		expect(formatDashboardMoney(0, "USD")).toBe("USD 0");
		expect(formatDashboardMoney(123_400, "USD")).toBe("USD 1,234");
		expect(formatDashboardMoney(123_456, "EUR")).toBe("EUR 1,234.56");
		expect(formatDashboardMoney(-125, "GBP")).toBe("GBP -1.25");
		expect(formatDashboardMoney(123_456, "JPY")).toBe("JPY 1,235");
	});

	it("keeps compact amounts in units rather than cents", () => {
		expect(formatDashboardMoneyCompact(0, "USD")).toBe("USD 0");
		expect(formatDashboardMoneyCompact(125, "USD")).toBe("USD 1.3");
		expect(formatDashboardMoneyCompact(100_000, "USD")).toBe("USD 1K");
		expect(formatDashboardMoneyCompact(125_000, "EUR")).toBe("EUR 1.3K");
		expect(formatDashboardMoneyCompact(100_000_000, "GBP")).toBe("GBP 1M");
		expect(formatDashboardMoneyCompact(-125_000, "CHF")).toBe("CHF -1.3K");
	});

	it("normalizes codes and rejects non-finite amounts", () => {
		for (const format of [formatDashboardMoney, formatDashboardMoneyCompact]) {
			expect(format(0, "usd")).toBe("USD 0");
			expect(format(0, "invalid")).toBe("USD 0");
			expect(format(-0, "USD")).toBe("USD 0");
			expect(format(Number.NaN, "USD")).toBe("—");
			expect(format(Number.POSITIVE_INFINITY, "USD")).toBe("—");
		}
	});
});
