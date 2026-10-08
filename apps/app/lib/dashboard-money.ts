const MONEY_LOCALE = "en-US";
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

function displayCurrency(currency: string): string {
	return CURRENCY_CODE.test(currency) ? currency.toUpperCase() : "USD";
}

export function formatDashboardMoney(cents: number, currency: string): string {
	if (!Number.isFinite(cents)) return "—";

	const code = displayCurrency(currency);
	const digits =
		new Intl.NumberFormat(MONEY_LOCALE, {
			style: "currency",
			currency: code,
		}).resolvedOptions().maximumFractionDigits ?? 2;
	const whole = cents % 100 === 0;
	const value = new Intl.NumberFormat(MONEY_LOCALE, {
		minimumFractionDigits: whole ? 0 : Math.min(2, digits),
		maximumFractionDigits: whole ? 0 : digits,
	}).format(cents === 0 ? 0 : cents / 100);

	return `${code} ${value}`;
}

export function formatDashboardMoneyCompact(
	cents: number,
	currency: string,
): string {
	if (!Number.isFinite(cents)) return "—";

	const value = new Intl.NumberFormat(MONEY_LOCALE, {
		notation: "compact",
		maximumFractionDigits: cents % 100_000 === 0 ? 0 : 1,
	}).format(cents === 0 ? 0 : cents / 100);

	return `${displayCurrency(currency)} ${value}`;
}
