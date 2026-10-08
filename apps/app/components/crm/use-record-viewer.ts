"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { RECORD_CONTROL } from "./record-control-config";
import type { RecordViewer } from "./record-control-policy";

export function useRecordViewer() {
	const trpc = useTRPC();
	const workspace = useQuery({
		...trpc.workspace.get.queryOptions(),
		refetchInterval: RECORD_CONTROL.refreshIntervalMs,
	});
	const me = useQuery({
		...trpc.users.me.queryOptions(),
		refetchInterval: RECORD_CONTROL.refreshIntervalMs,
	});
	const viewer: RecordViewer =
		workspace.isSuccess && me.isSuccess && workspace.data.viewerRole
			? { id: me.data.id, role: workspace.data.viewerRole }
			: null;
	return {
		viewer,
		loading: workspace.isPending || me.isPending,
		error: workspace.isError || me.isError,
	};
}

export function useRecordOwners(enabled: boolean) {
	const trpc = useTRPC();
	const query = useQuery({
		...trpc.workspace.members.queryOptions({ activeOnly: true, pageSize: 100 }),
		enabled,
		refetchInterval: RECORD_CONTROL.refreshIntervalMs,
	});
	return {
		users: query.isSuccess
			? query.data.rows.map((user) => ({ id: user.userId, name: user.name }))
			: [],
		ready: enabled && query.isSuccess,
	};
}
