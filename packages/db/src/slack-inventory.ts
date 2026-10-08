import { isAiEnabled } from "@crm/env/features";
import { PRIORITY } from "./agent-tasks";
import { type Db, db } from "./client";
import { lockIdempotencyKey } from "./idempotency";

const MINUTE_MS = 60_000;

export const SLACK_INVENTORY = {
	kind: "slack-people-match",
	lock: "slack-inventory",
	priority: PRIORITY.slackPeople,
	budget: 1,
	throttleMs: 15 * MINUTE_MS,
} as const;

export async function queueSlackInventorySync(
	reason: string,
	database: Db = db,
): Promise<void> {
	if (!isAiEnabled()) return;
	const since = new Date(Date.now() - SLACK_INVENTORY.throttleMs);

	try {
		await database.$transaction(async (tx) => {
			if (!isAiEnabled()) return;
			await lockIdempotencyKey(tx, SLACK_INVENTORY.lock);
			if (!isAiEnabled()) return;

			const recent = await tx.agentTask.findFirst({
				where: {
					kind: SLACK_INVENTORY.kind,
					OR: [{ finishedAt: null }, { createdAt: { gt: since } }],
				},
				select: { id: true },
			});
			if (recent || !isAiEnabled()) return;

			await tx.agentTask.create({
				data: {
					kind: SLACK_INVENTORY.kind,
					reason,
					priority: SLACK_INVENTORY.priority,
					budget: SLACK_INVENTORY.budget,
					dueAt: new Date(),
				},
			});
		});
	} catch {
		return;
	}
}
