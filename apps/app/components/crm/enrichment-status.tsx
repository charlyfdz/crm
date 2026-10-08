import type { EnrichmentStatus } from "@crm/db/enums";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { enrichmentPresentation } from "@/lib/enrichment-status";

export function EnrichmentIndicator({
	status,
	queued = false,
	aiEnabled = true,
	title,
	className,
}: {
	status: EnrichmentStatus;
	queued?: boolean;
	aiEnabled?: boolean;
	title?: string | null;
	className?: string;
}) {
	const { label, tone, busy } = enrichmentPresentation(
		status,
		queued,
		aiEnabled,
	);

	return (
		<StatusIndicator
			tone={tone}
			busy={busy}
			label={label}
			title={title ?? undefined}
			className={className}
		/>
	);
}
