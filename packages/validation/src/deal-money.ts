import { z } from "zod";

export const MAX_AMOUNT_CENTS = 99_999_999_999_999;

const decimalAmount = z
	.string()
	.trim()
	.max(16)
	.regex(
		/^\d+(?:\.\d{1,2})?$/,
		"Usa un importe positivo con punto decimal y hasta dos decimales.",
	);

export function parseDealAmount(value: string): number | null {
	if (!value.trim()) return null;
	const [whole, fraction = ""] = decimalAmount.parse(value).split(".");
	const cents =
		BigInt(whole ?? "0") * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
	return z
		.number()
		.int()
		.min(0)
		.max(MAX_AMOUNT_CENTS, "El importe supera el límite del registro.")
		.parse(Number(cents));
}
