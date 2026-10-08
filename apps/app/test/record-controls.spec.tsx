import { describe, expect, it } from "bun:test";
import { Suggestion } from "@crm/ui/components/suggestion";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineCompanyField } from "../components/crm/company-picker";
import {
	InlineDateField,
	InlineField,
	InlineSelectField,
	InlineTextArea,
	InlineTextCell,
} from "../components/crm/inline-field";
import {
	type ControlledRecord,
	eligibleRecordIds,
	recordControls,
	recordOwnerOptions,
} from "../components/crm/record-control-policy";
import {
	RecordEditScope,
	RecordReadOnlyNotice,
} from "../components/crm/record-edit-scope";
import { AddRow } from "../components/crm/record-sheet/record-parts";

const owned: ControlledRecord = {
	id: "own",
	owner: { id: "member", name: "Persona ficticia" },
	archivedAt: null,
};
const foreign: ControlledRecord = {
	...owned,
	id: "foreign",
	owner: { id: "other", name: "Otra persona ficticia" },
};
const unassigned = { ...owned, id: "unassigned", owner: null };
const archived = {
	...owned,
	id: "archived",
	archivedAt: "2026-10-04T00:00:00Z",
};
const viewer = { id: "member", role: "member" };
const rows = [owned, foreign, unassigned, archived];

describe("visible record controls", () => {
	for (const role of [
		"owner",
		"admin",
		"member",
		"manager",
		"rep",
		"viewer",
		"unknown",
		"",
	]) {
		for (const record of rows) {
			it(`derives ${role || "missing role"} controls for ${record.id}`, () => {
				const controls = recordControls({ id: "member", role }, record);
				const elevated = role === "owner" || role === "admin";
				const member = role === "member";
				const responsible =
					elevated || (member && record.owner?.id === "member");
				expect(controls.canCreate).toBe(elevated || member);
				expect(controls.canEdit).toBe(responsible && !record.archivedAt);
				expect(controls.canAssign).toBe(elevated && !record.archivedAt);
				expect(controls.canArchive).toBe(responsible && !record.archivedAt);
				expect(controls.canRestore).toBe(
					responsible && Boolean(record.archivedAt),
				);
				expect(controls.canPurge).toBe(
					role === "owner" && Boolean(record.archivedAt),
				);
			});
		}
	}
	it("fails closed while session is missing or actor identity is empty", () => {
		for (const actor of [null, { id: "", role: "owner" }]) {
			for (const record of rows)
				expect(Object.values(recordControls(actor, record))).toEqual([
					false,
					false,
					false,
					false,
					false,
					false,
				]);
		}
	});
	it("does not silently grant ownership of an unassigned record to a member", () => {
		expect(recordControls(viewer, unassigned).canEdit).toBe(false);
		expect(recordControls(viewer, unassigned).canAssign).toBe(false);
	});
	it("drops old control authority after responsibility or role changes", () => {
		expect(recordControls(viewer, owned).canEdit).toBe(true);
		expect(
			recordControls(viewer, { ...owned, owner: foreign.owner }).canEdit,
		).toBe(false);
		expect(recordControls({ id: "other", role: "owner" }, owned).canEdit).toBe(
			true,
		);
		expect(recordControls({ id: "other", role: "member" }, owned).canEdit).toBe(
			false,
		);
	});
	it("filters mixed bulk selections using loaded rows and removes duplicate identifiers", () => {
		const ids = ["foreign", "missing", "own", "archived", "own", "unassigned"];
		expect(eligibleRecordIds(viewer, ids, rows, "canEdit")).toEqual(["own"]);
		expect(eligibleRecordIds(viewer, ids, rows, "canRestore")).toEqual([
			"archived",
		]);
		expect(eligibleRecordIds(viewer, ids, rows, "canPurge")).toEqual([]);
		expect(eligibleRecordIds(null, ids, rows, "canArchive")).toEqual([]);
		expect(
			eligibleRecordIds({ id: "admin", role: "admin" }, ids, rows, "canEdit"),
		).toEqual(["foreign", "own", "unassigned"]);
		expect(
			eligibleRecordIds({ id: "owner", role: "owner" }, ids, rows, "canPurge"),
		).toEqual(["archived"]);
	});
	it("keeps a historical owner visible without making them assignable", () => {
		const options = recordOwnerOptions(
			[{ id: "new", name: "Persona activa" }],
			owned.owner,
			"none",
		);
		expect(options).toEqual([
			{ value: "none", label: "Sin responsable" },
			{ value: "new", label: "Persona activa" },
			{
				value: "member",
				label: "Persona ficticia · No disponible para asignación",
				disabled: true,
			},
		]);
		expect(
			recordOwnerOptions(
				[{ id: "member", name: "Persona activa" }],
				owned.owner,
			),
		).toHaveLength(1);
	});
});

describe("read-only field rendering", () => {
	const save = () => {
		throw new Error("Read-only controls must not save while rendering.");
	};
	const fields = [
		[
			"text",
			<InlineField
				key="text"
				label="Nombre"
				value="Empresa ficticia"
				onSave={save}
			/>,
		],
		[
			"select",
			<InlineSelectField
				key="select"
				label="Responsable"
				value="member"
				options={[{ value: "member", label: "Persona ficticia" }]}
				onSave={save}
			/>,
		],
		[
			"date",
			<InlineDateField
				key="date"
				label="Fecha"
				value="2026-10-04"
				onSave={save}
			/>,
		],
		[
			"textarea",
			<InlineTextArea
				key="textarea"
				label="Nota"
				value="Nota ficticia"
				onSave={save}
			/>,
		],
		[
			"cell",
			<InlineTextCell
				key="cell"
				label="Rol"
				value="Rol ficticio"
				onSave={save}
			/>,
		],
		[
			"company",
			<InlineCompanyField
				key="company"
				value="company"
				company={{ id: "company", name: "Empresa ficticia" }}
				onSave={save}
			/>,
		],
	] as const;
	for (const [name, field] of fields) {
		it(`renders ${name} as readable content without an editing control`, () => {
			const html = renderToStaticMarkup(
				<RecordEditScope readOnly>{field}</RecordEditScope>,
			);
			expect(html).not.toContain("<button");
			expect(html).not.toContain("<input");
			expect(html).not.toContain("<textarea");
			expect(html).not.toContain('role="combobox"');
			expect(html).toContain(name === "date" ? "2026-10-04" : "fictici");
		});
	}
	it("nested scopes cannot reopen a locked parent", () => {
		const html = renderToStaticMarkup(
			<RecordEditScope readOnly>
				<RecordEditScope readOnly={false}>{fields[0][1]}</RecordEditScope>
			</RecordEditScope>,
		);
		expect(html).not.toContain("<button");
		expect(html).toContain("Empresa ficticia");
	});
	it("retains normal editing outside a read-only scope", () => {
		const html = renderToStaticMarkup(fields[0][1]);
		expect(html).toContain("<button");
	});
	it("explicitly locks reassignment while other fields remain editable", () => {
		const html = renderToStaticMarkup(
			<InlineSelectField
				label="Responsable"
				value="member"
				options={recordOwnerOptions([], owned.owner)}
				readOnly
				onSave={save}
			/>,
		);
		expect(html).not.toContain("<button");
		expect(html).toContain("Persona ficticia");
	});
	it("discloses permission loading, errors and archived records", () => {
		for (const [loading, error, archivedFlag, expected] of [
			[true, false, false, "Comprobando permisos"],
			[false, true, false, "No se pueden comprobar tus permisos"],
			[false, false, true, "Restaura el registro"],
			[false, false, false, "El responsable o administración"],
		] as const) {
			const html = renderToStaticMarkup(
				<RecordReadOnlyNotice
					loading={loading}
					error={error}
					archived={archivedFlag}
				/>,
			);
			expect(html).toContain(expected);
		}
	});
	it("shows suggestions and evidence without accepting or dismissing them", () => {
		const html = renderToStaticMarkup(
			<Suggestion
				readOnly
				value="Cargo propuesto"
				rationale="Evidencia ficticia"
				onAccept={save}
				onDismiss={save}
			/>,
		);
		expect(html).toContain("Cargo propuesto");
		expect(html).toContain("Evidencia ficticia");
		expect(html).not.toContain("<button");
	});
	it("disables adding relations when the caller lacks permission", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<AddRow label="Añadir contacto" columns={2} disabled onClick={save} />
				</tbody>
			</table>,
		);
		expect(html).toContain('disabled=""');
		expect(html).toContain("Añadir contacto");
	});
});
