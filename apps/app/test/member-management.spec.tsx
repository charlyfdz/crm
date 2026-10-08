import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberFields } from "../app/(app)/[slug]/settings/members/member-management";
import {
	creatableRoles,
	memberActions,
} from "../app/(app)/[slug]/settings/members/member-policy";

const target = { role: "member", isViewer: false };
const draft = {
	name: "",
	email: "",
	password: "",
	role: "member" as const,
	reason: "",
};
const policy = { minLength: 12, maxLength: 128 };

describe("corporate membership UI policy and form rendering", () => {
	for (const role of [
		"owner",
		"admin",
		"member",
		"manager",
		"rep",
		"viewer",
		"unknown",
		null,
	]) {
		it(`limits management for ${role ?? "missing"} without accepting unsupported profiles`, () => {
			expect(memberActions(role, target).canManage).toBe(
				role === "owner" || role === "admin",
			);
			expect(creatableRoles(role).length > 0).toBe(
				role === "owner" || role === "admin",
			);
		});
	}
	it("only owner may manage privileged people or assign elevated roles", () => {
		for (const role of ["admin", "owner", "unsupported"]) {
			expect(memberActions("admin", { role, isViewer: false }).canManage).toBe(
				false,
			);
			expect(
				memberActions("owner", { role, isViewer: false }).roleOptions,
			).toEqual(["owner", "admin", "member"]);
		}
		expect(creatableRoles("admin")).toEqual(["member"]);
		expect(creatableRoles("owner")).toEqual(["admin", "member"]);
	});
	it("never offers administrative recovery for the acting person's own password", () => {
		expect(
			memberActions("owner", { role: "owner", isViewer: true })
				.canResetPassword,
		).toBe(false);
		expect(memberActions("admin", target).canResetPassword).toBe(true);
	});
	it("renders explicit local-account labels and password rules supplied by the server", () => {
		const html = renderToStaticMarkup(
			<MemberFields
				action={{ kind: "create" }}
				draft={draft}
				onChange={() => undefined}
				roles={["member"]}
				passwordPolicy={policy}
				disabled={false}
			/>,
		);
		expect(html).toContain("Correo autorizado");
		expect(html).toContain('type="password"');
		expect(html).toContain('minLength="12"');
		expect(html).toContain('maxLength="128"');
		expect(html).toContain('autoComplete="new-password"');
		expect(html).toContain("No se envía correo");
	});
	it("disables all fields during submission without turning the password into visible text", () => {
		const html = renderToStaticMarkup(
			<MemberFields
				action={{ kind: "create" }}
				draft={draft}
				onChange={() => undefined}
				roles={["member"]}
				passwordPolicy={policy}
				disabled
			/>,
		);
		expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(4);
		expect(html).not.toContain('type="text" value="Synthet');
	});
});
