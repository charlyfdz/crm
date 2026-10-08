export type ConnectionErrorKind = "idle" | "checked-out";

export function connectionErrorRecord(error: Error, kind: ConnectionErrorKind) {
	const code =
		"code" in error &&
		typeof error.code === "string" &&
		/^(?:[A-Z0-9]{5}|E[A-Z0-9_]{2,31})$/.test(error.code)
			? error.code
			: "UNKNOWN";

	return {
		level: "error" as const,
		target: kind === "idle" ? "pg.pool" : "pg.connection",
		message:
			kind === "idle"
				? `Idle database connection failed (${code}). The pool removes this connection.`
				: `Checked-out database connection failed (${code}). The operation must handle its failure.`,
	};
}
