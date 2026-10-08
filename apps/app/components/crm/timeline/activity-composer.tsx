"use client";

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@crm/ui/components/input-group";
import { Spinner } from "@crm/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { activityLabel } from "@/lib/activity-presentation";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { ActivityTaskCreateControl } from "../activity-tasks/activity-task-controls";
import { ActivityIcon } from "./activity-icon";
import type { TimelineAnchor } from "./timeline";

const TYPES = ["NOTE", "CALL", "EMAIL", "MEETING", "TASK"] as const;

type ComposableType = (typeof TYPES)[number];

const PLACEHOLDER = {
	NOTE: "Log a note, call, email, meeting or task…",
	CALL: "What came out of the call?",
	EMAIL: "What was said?",
	MEETING: "What came out of the meeting?",
	TASK: "What needs doing?",
} satisfies Record<ComposableType, string>;

export function ActivityComposer({ anchor }: { anchor: TimelineAnchor }) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [type, setType] = useState<ComposableType>("NOTE");
	const [draft, setDraft] = useState("");

	const isTask = type === "TASK";
	const text = draft.trim();

	const reset = () => {
		setDraft("");
	};

	const create = useMutation(
		trpc.activities.create.mutationOptions({
			onSuccess: async () => {
				await cache.activity();
				reset();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const submit = () => {
		if (isTask || text === "" || create.isPending) return;
		create.mutate({
			...anchor,
			type,
			body: text,
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<InputGroup>
				{!isTask ? (
					<InputGroupTextarea
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder={PLACEHOLDER[type]}
						aria-label="What happened"
						onKeyDown={(event) => {
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								submit();
							}
							if (event.key === "Escape") reset();
						}}
					/>
				) : null}

				<InputGroupAddon align="block-end" className="gap-2 border-t">
					<ToggleGroup
						type="single"
						value={type}
						onValueChange={(next) => next && setType(next as ComposableType)}
						size="sm"
						spacing={0}
					>
						{TYPES.map((option) => (
							<ToggleGroupItem
								key={option}
								value={option}
								aria-label={activityLabel(option)}
							>
								<ActivityIcon type={option} />
								{activityLabel(option)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>

					{isTask || text === "" ? null : (
						<InputGroupButton
							type="button"
							onClick={submit}
							variant="default"
							size="xs"
							className="ml-auto"
							disabled={create.isPending}
						>
							{create.isPending ? <Spinner /> : null}
							{`Log ${activityLabel(type).toLowerCase()}`}
						</InputGroupButton>
					)}
				</InputGroupAddon>
			</InputGroup>
			{isTask ? <ActivityTaskCreateControl anchor={anchor} /> : null}
		</div>
	);
}
