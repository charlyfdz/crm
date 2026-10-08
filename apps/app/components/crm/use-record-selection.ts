"use client";

import {
	type ControlledRecord,
	eligibleRecordIds,
} from "./record-control-policy";
import { useRecordViewer } from "./use-record-viewer";

export type BulkRecord = ControlledRecord & { ai: { enabled: boolean } };

export function useRecordSelection(ids: string[], rows: BulkRecord[]) {
	const { viewer, loading, error } = useRecordViewer();
	const editIds = eligibleRecordIds(viewer, ids, rows, "canEdit");
	const aiIds = new Set(
		rows.filter((row) => row.ai.enabled).map((row) => row.id),
	);
	return {
		viewer,
		loading,
		error,
		editIds,
		archiveIds: eligibleRecordIds(viewer, ids, rows, "canArchive"),
		restoreIds: eligibleRecordIds(viewer, ids, rows, "canRestore"),
		purgeIds: eligibleRecordIds(viewer, ids, rows, "canPurge"),
		enrichIds: editIds.filter((id) => aiIds.has(id)),
		canAssign: viewer?.role === "owner" || viewer?.role === "admin",
	};
}
