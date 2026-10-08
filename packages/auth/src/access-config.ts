export const ACCESS = {
	password: { minLength: 12, maxLength: 128 },
	provision: { advisoryLock: 734291, transactionTimeoutMs: 15_000 },
} as const;
