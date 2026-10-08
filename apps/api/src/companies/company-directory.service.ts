import { EnrichmentStatus, type Prisma } from "@crm/db";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { isAiEnabled } from "@crm/env/features";
import { Injectable, Logger } from "@nestjs/common";
import {
	AgentTriggerService,
	type CrmEventInput,
} from "../agent/agent-trigger.service";
import { domainFromEmail } from "./domain";

@Injectable()
export class CompanyDirectoryService {
	private readonly logger = new Logger(CompanyDirectoryService.name);

	constructor(private readonly agent: AgentTriggerService) {}

	async companyForContact(
		tx: Prisma.TransactionClient,
		emit: (input: CrmEventInput) => Promise<void>,
		email: string,
		ownerId: string | null,
	): Promise<string | null> {
		const domain = domainFromEmail(email);
		if (!domain) return null;
		await lockIdempotencyKey(tx, `company-directory:${domain}`);
		const existing = await tx.company.findFirst({
			where: { domain, archivedAt: null },
			select: { id: true },
		});
		if (existing) return existing.id;
		const company = await tx.company.create({
			data: {
				name: domain,
				domain,
				website: `https://${domain}`,
				ownerId,
				enrichmentStatus: isAiEnabled()
					? EnrichmentStatus.PENDING
					: EnrichmentStatus.SKIPPED,
			},
			select: { id: true, name: true, domain: true, createdAt: true },
		});
		await emit({
			type: "company.created",
			record: { kind: "company", id: company.id },
			occurredAt: company.createdAt,
			data: { name: company.name, domain: company.domain },
		});
		if (isAiEnabled())
			await this.agent.companyCreated(
				company.id,
				"Created from a contact email domain",
				tx,
			);
		return company.id;
	}

	async companyForEmail(
		email: string,
		options: { ownerId?: string | null } = {},
	): Promise<string | null> {
		const domain = domainFromEmail(email);
		if (!domain) return null;

		const outcome = await this.agent.withCrmEvents(async (tx, emit) => {
			await lockIdempotencyKey(tx, `company-directory:${domain}`);
			const existing = await tx.company.findFirst({
				where: { domain, archivedAt: null },
				select: { id: true },
			});
			if (existing) return { id: existing.id, created: false as const };

			const company = await tx.company.create({
				data: {
					name: domain,
					domain,
					website: `https://${domain}`,
					enrichmentStatus: isAiEnabled()
						? EnrichmentStatus.PENDING
						: EnrichmentStatus.SKIPPED,
					ownerId: options.ownerId ?? null,
				},
				select: { id: true, name: true, domain: true, createdAt: true },
			});
			await emit({
				type: "company.created",
				record: { kind: "company", id: company.id },
				occurredAt: company.createdAt,
				data: { name: company.name, domain: company.domain },
			});
			return { id: company.id, created: true as const };
		});
		if (!outcome.created) return outcome.id;

		if (isAiEnabled()) {
			await this.agent.companyCreated(
				outcome.id,
				`Created from an email domain (${domain}) — it has no name but the domain`,
			);
		}

		this.logger.log({
			message: "Company created from an email domain",
			companyId: outcome.id,
			domain,
		});

		return outcome.id;
	}
}
