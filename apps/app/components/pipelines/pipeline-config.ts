export const PIPELINE_EDITOR = {
	nameLength: 100,
	stageLimit: 30,
	stageMinimum: 3,
	reasonLength: 2000,
	dateOptions: {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	} satisfies Intl.DateTimeFormatOptions,
} as const;
