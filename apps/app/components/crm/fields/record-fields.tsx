"use client";

import Settings from "@carbon/icons-react/es/Settings";
import type { FieldValueJson } from "@crm/db/fields";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Icon } from "@crm/ui/components/icon";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import {
	InlineDateField,
	InlineField,
	InlineSelectField,
	InlineTextArea,
} from "@/components/crm/inline-field";
import {
	type RecordKind,
	useFieldsSheet,
} from "@/components/crm/record-sheet/record-stack";
import { DetailSheetProperty } from "@/components/detail-sheet";
import { useRecordReadOnly } from "../record-edit-scope";
import { useRecordOwners, useRecordViewer } from "../use-record-viewer";

type RecordFieldOption = { id: string; label: string };

export type RecordFieldEntry = {
	id: string;
	key: string;
	label: string;
	type: string;
	showOnSheet: boolean;
	options: RecordFieldOption[];
	value: FieldValueJson;
};

const NONE = "__none__";

const UNASSIGNED = "Unassigned";

const FORMER_MEMBER = "Usuario fuera de la lista activa";

export function FieldsCog({ kind }: { kind: RecordKind }) {
	const { open } = useFieldsSheet();
	const { viewer } = useRecordViewer();
	if (viewer?.role !== "owner" && viewer?.role !== "admin") return null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon-sm" onClick={() => open(kind)}>
					<Icon icon={Settings} />
					<span className="sr-only">Fields</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>Fields</TooltipContent>
		</Tooltip>
	);
}

export function RecordFields({
	fields,
	saving,
	onSave,
}: {
	fields: RecordFieldEntry[];
	saving: (key: string) => boolean;
	onSave: (values: Record<string, FieldValueJson>) => void;
}) {
	const locked = useRecordReadOnly();
	const users = useRecordOwners(!locked);

	const userOptionsFor = (value: string) => {
		const options = [
			{ value: NONE, label: UNASSIGNED },
			...users.users.map((user) => ({
				value: user.id,
				label: user.name,
			})),
		];

		if (!options.some((option) => option.value === value)) {
			options.push({ value, label: FORMER_MEMBER });
		}

		return options;
	};

	return (
		<>
			{fields
				.filter((field) => field.showOnSheet)
				.map((field) => {
					const save = (value: FieldValueJson) => {
						if (!locked) onSave({ [field.key]: value });
					};
					const busy = saving(field.key);

					if (field.type === "CHECKBOX") {
						return (
							<DetailSheetProperty key={field.id} label={field.label}>
								<Checkbox
									checked={field.value === true}
									disabled={busy || locked}
									onCheckedChange={(checked) => save(checked === true)}
								/>
							</DetailSheetProperty>
						);
					}

					if (field.type === "LONG_TEXT") {
						return (
							<DetailSheetProperty key={field.id} label={field.label} wide>
								<InlineTextArea
									label={field.label}
									value={field.value === null ? null : String(field.value)}
									saving={busy}
									onSave={save}
								/>
							</DetailSheetProperty>
						);
					}

					if (field.type === "DATE") {
						return (
							<InlineDateField
								key={field.id}
								label={field.label}
								value={field.value === null ? null : String(field.value)}
								saving={busy}
								onSave={save}
							/>
						);
					}

					if (field.type === "SELECT") {
						return (
							<InlineSelectField
								key={field.id}
								label={field.label}
								value={field.value === null ? NONE : String(field.value)}
								options={[
									{ value: NONE, label: "None" },
									...field.options.map((option) => ({
										value: option.id,
										label: option.label,
									})),
								]}
								saving={busy}
								onSave={(next) => save(next === NONE ? null : next)}
							/>
						);
					}

					if (field.type === "USER") {
						const current = field.value === null ? NONE : String(field.value);

						return (
							<InlineSelectField
								key={field.id}
								label={field.label}
								value={current}
								options={userOptionsFor(current)}
								readOnly={locked || !users.ready}
								placeholder={UNASSIGNED}
								saving={busy}
								onSave={(next) => save(next === NONE ? null : next)}
							/>
						);
					}

					return (
						<InlineField
							key={field.id}
							label={field.label}
							type={
								field.type === "URL"
									? "url"
									: field.type === "EMAIL"
										? "email"
										: field.type === "PHONE"
											? "tel"
											: "text"
							}
							value={field.value === null ? null : String(field.value)}
							saving={busy}
							onSave={save}
						/>
					);
				})}
		</>
	);
}
