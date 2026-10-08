export type RecordViewer = { id: string; role: string } | null;

export type ControlledRecord = {
	id: string;
	owner: { id: string; name: string } | null;
	archivedAt: string | null;
};

export function recordControls(viewer: RecordViewer, record: ControlledRecord) {
	const valid = Boolean(viewer?.id);
	const elevated =
		valid && (viewer?.role === "owner" || viewer?.role === "admin");
	const member = valid && (elevated || viewer?.role === "member");
	const responsible = Boolean(
		viewer && member && (elevated || record.owner?.id === viewer.id),
	);
	return {
		canCreate: Boolean(viewer && member),
		canEdit: responsible && !record.archivedAt,
		canAssign: Boolean(viewer && elevated && !record.archivedAt),
		canArchive: responsible && !record.archivedAt,
		canRestore: responsible && Boolean(record.archivedAt),
		canPurge: valid && viewer?.role === "owner" && Boolean(record.archivedAt),
	};
}

export type RecordControls = ReturnType<typeof recordControls>;
export type RecordAction = "canArchive" | "canRestore" | "canPurge" | "canEdit";

export function eligibleRecordIds(
	viewer: RecordViewer,
	ids: string[],
	rows: ControlledRecord[],
	action: RecordAction,
) {
	const byId = new Map(rows.map((record) => [record.id, record]));
	return [...new Set(ids)].filter((id) => {
		const record = byId.get(id);
		return record ? recordControls(viewer, record)[action] : false;
	});
}

export function recordOwnerOptions(
	users: { id: string; name: string }[],
	current: ControlledRecord["owner"],
	none?: string,
) {
	const options: { value: string; label: string; disabled?: boolean }[] = [
		...(none ? [{ value: none, label: "Sin responsable" }] : []),
		...users.map((user) => ({ value: user.id, label: user.name })),
	];
	if (current && !users.some((user) => user.id === current.id))
		options.push({
			value: current.id,
			label: `${current.name} · No disponible para asignación`,
			disabled: true,
		});
	return options;
}
