import { defineHook } from "eve/hooks";
import { guardAiExecution } from "../lib/ai-policy";

export default defineHook({
	events: {
		"turn.started": guardAiExecution,
		"step.started": guardAiExecution,
		"actions.requested": guardAiExecution,
	},
});
