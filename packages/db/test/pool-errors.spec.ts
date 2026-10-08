import { describe, expect, it } from "bun:test";
import { connectionErrorRecord } from "../src/pool-errors";

describe("database connection diagnostics", () => {
	it("reports an idle connection failure without SQL, credentials, or stack", () => {
		const error = Object.assign(
			new Error(
				"postgresql://user:secret@localhost/private SELECT personal_data",
			),
			{ code: "57P01", detail: "private row", host: "private host" },
		);
		const record = connectionErrorRecord(error, "idle");
		expect(record.level).toBe("error");
		expect(record.target).toBe("pg.pool");
		expect(record.message).toContain("57P01");
		expect(record.message).toContain("removes this connection");
		for (const value of ["secret", "personal_data", "private", "stack"]) {
			expect(JSON.stringify(record)).not.toContain(value);
		}
	});

	it("distinguishes checked-out failures from idle eviction", () => {
		const record = connectionErrorRecord(
			Object.assign(new Error("connection reset"), { code: "ECONNRESET" }),
			"checked-out",
		);
		expect(record.target).toBe("pg.connection");
		expect(record.message).toContain("ECONNRESET");
		expect(record.message).toContain("operation must handle its failure");
		expect(record.message).not.toContain("removes");
	});

	it("handles errors without a driver code", () => {
		expect(
			connectionErrorRecord(new Error("private text"), "idle").message,
		).toContain("UNKNOWN");
	});

	it("rejects non-string and malformed codes", () => {
		for (const code of [null, 57, "57P01\nsecret", "postgresql://secret", ""]) {
			const record = connectionErrorRecord(
				Object.assign(new Error("private text"), { code }),
				"idle",
			);
			expect(record.message).toContain("UNKNOWN");
			expect(record.message).not.toContain("secret");
		}
	});
});
