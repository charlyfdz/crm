export function emptyPipelineLabel(totalDeals: number): string {
	return totalDeals === 0
		? "No hay oportunidades abiertas"
		: `${totalDeals} oportunidades abiertas; sin importe positivo para graficar`;
}

export function unconvertedLabel(count: number, currencies: string[]): string {
	const population = count === 1 ? "oportunidad" : "oportunidades";
	return `${count} ${population} en ${currencies.join(", ")} sin conversión válida. Sus importes no se incluyen.`;
}

export const EMPTY_TREND_LABEL =
	"No hay importes positivos para graficar en este período";
