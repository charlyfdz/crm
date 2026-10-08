import { describe, expect, it } from "bun:test";
import { provisionUserInput } from "../src/provision-input";

const account = { name: "Operador de prueba", email: "operator@example.test", password: "Synthet1c-Long-Password" };

describe("managed provisioning input", () => {
	it("normalizes email and defaults to member", () => {
		const result = provisionUserInput.parse({ ...account, email: "  Operator@Example.test  " });
		expect(result.email).toBe("operator@example.test");
		expect(result.role).toBe("member");
	});
	it("rejects short passwords", () => {
		expect(provisionUserInput.safeParse({ ...account, password: "short" }).success).toBe(false);
	});
	it("only bootstrap creates the first owner", () => {
		expect(provisionUserInput.safeParse({ ...account, role: "owner" }).success).toBe(false);
		expect(provisionUserInput.safeParse({ ...account, bootstrap: true }).success).toBe(false);
		expect(provisionUserInput.safeParse({ ...account, role: "owner", bootstrap: true }).success).toBe(true);
	});
	it("rejects unknown fields", () => {
		expect(provisionUserInput.safeParse({ ...account, bypass: true }).success).toBe(false);
	});
});
