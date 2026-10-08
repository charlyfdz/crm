import { type Db, type FieldEntity, type Prisma } from "@crm/db";
import { fieldKeyFromLabel, serializeField, usesOptions } from "@crm/db/fields";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { isAiEnabled } from "@crm/env/features";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { AgentTriggerService } from "../agent/agent-trigger.service";
import { requireApiAiEnabled } from "../agent/ai-policy";
import { recordMembership } from "../crm/record-access";
import { FIELDS_CONFIG } from "./fields-config";
import type { FieldCreateInput, FieldReorderInput, FieldUpdateData } from "./fields.contracts";

const WITH_OPTIONS = { options: { orderBy: { position: "asc" } } } as const;
type Definition = Prisma.FieldDefinitionGetPayload<{ include: typeof WITH_OPTIONS }>;

export class FieldManagement {
	constructor(private readonly db: Db, private readonly agent: AgentTriggerService) {}

	private async write<T>(userId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>, ownerOnly = false) {
		return this.db.$transaction(async (tx) => {
			await recordMembership(tx, userId, { lock: true, administrative: true, ownerOnly });
			await lockIdempotencyKey(tx, "crm:field-management");
			return operation(tx);
		});
	}

	private async definition(tx: Prisma.TransactionClient, id: string) {
		await tx.$queryRaw`SELECT id FROM "field_definition" WHERE id = ${id} FOR UPDATE`;
		const row = await tx.fieldDefinition.findUnique({ where: { id }, include: WITH_OPTIONS });
		if (!row) throw new NotFoundException("That field does not exist.");
		return row;
	}

	private async queue(tx: Prisma.TransactionClient, definition: Definition, reason: string) {
		if (!isAiEnabled() || !definition.agentFilled || definition.archivedAt) return false;
		const where = { archivedAt: null, fieldValues: { none: { fieldId: definition.id } } };
		const args = { where, select: { id: true }, take: FIELDS_CONFIG.backfill.maxRecordsPerRun, orderBy: { id: "asc" as const } };
		const rows = definition.entity === "COMPANY" ? await tx.company.findMany(args)
			: definition.entity === "CONTACT" ? await tx.contact.findMany(args) : await tx.deal.findMany(args);
		const result = await this.agent.fieldBackfillRecords(definition.entity, [definition.key], rows.map((row) => row.id), reason, tx);
		return result.queued > 0 || result.merged > 0;
	}

	async create(input: FieldCreateInput, userId: string) {
		const result = await this.write(userId, async (tx) => {
			const key = fieldKeyFromLabel(input.label);
			if (!key) throw new BadRequestException("That label does not make a usable key.");
			const taken = await tx.fieldDefinition.findUnique({ where: { entity_key: { entity: input.entity, key } }, select: { id: true } });
			if (taken) throw new ConflictException(`There is already a field called "${key}".`);
			if (usesOptions(input.type) && input.options.length === 0) throw new BadRequestException("A select needs at least one option.");
			if (input.options.some((option) => option.id)) throw new BadRequestException("New fields cannot reuse option identifiers.");
			const last = await tx.fieldDefinition.findFirst({ where: { entity: input.entity }, orderBy: { position: "desc" }, select: { position: true } });
			const { options, ...data } = input;
			const row = await tx.fieldDefinition.create({ data: { ...data, key, position: (last?.position ?? -1) + 1, options: usesOptions(input.type) ? { create: options.map((option, position) => ({ label: option.label, position })) } : undefined }, include: WITH_OPTIONS });
			return { field: serializeField(row), queued: await this.queue(tx, row, `New field: ${row.label}`) };
		});
		if (result.queued) this.agent.drainAfterCommit();
		return result.field;
	}

	async update(id: string, data: FieldUpdateData, userId: string) {
		const result = await this.write(userId, async (tx) => {
			const existing = await this.definition(tx, id);
			if (existing.archivedAt) throw new BadRequestException("Restore the field before editing it.");
			const type = data.type ?? existing.type;
			if (data.type && data.type !== existing.type && await tx.fieldValue.count({ where: { fieldId: id } })) throw new ConflictException("This field already holds values, so its type cannot change. Archive it and make a new one.");
			const options = data.options;
			if (usesOptions(type) && (options?.length ?? existing.options.filter((option) => !option.archivedAt).length) === 0) throw new BadRequestException("A select needs at least one option.");
			if (options) await this.options(tx, existing, type, options);
			const { options: _options, ...changes } = data;
			const row = await tx.fieldDefinition.update({ where: { id }, data: changes, include: WITH_OPTIONS });
			const briefChanged = data.agentBrief !== undefined && data.agentBrief !== existing.agentBrief;
			const turnedOn = data.agentFilled === true && !existing.agentFilled;
			const queued = briefChanged || turnedOn ? await this.queue(tx, row, `${briefChanged ? "Brief changed" : "Turned on"}: ${row.label}`) : false;
			return { field: serializeField(row), queued };
		});
		if (result.queued) this.agent.drainAfterCommit();
		return result.field;
	}

	private async options(tx: Prisma.TransactionClient, existing: Definition, type: string, options: NonNullable<FieldUpdateData["options"]>) {
		if (!usesOptions(type as Definition["type"])) {
			if (options.length) throw new BadRequestException("Only select fields accept options.");
			return;
		}
		const ids = options.flatMap((option) => option.id ? [option.id] : []);
		if (new Set(ids).size !== ids.length || ids.some((id) => !existing.options.some((option) => option.id === id))) throw new BadRequestException("An option identifier does not belong to this field or is repeated.");
		await tx.fieldOption.updateMany({ where: { fieldId: existing.id, id: { notIn: ids }, archivedAt: null }, data: { archivedAt: new Date() } });
		for (const [position, option] of options.entries()) {
			if (option.id) await tx.fieldOption.update({ where: { id: option.id, fieldId: existing.id }, data: { label: option.label, position, archivedAt: null } });
			else await tx.fieldOption.create({ data: { fieldId: existing.id, label: option.label, position } });
		}
	}

	async reorder(input: FieldReorderInput, userId: string) {
		return this.write(userId, async (tx) => {
			const rows = await tx.fieldDefinition.findMany({ where: { id: { in: input.ids }, entity: input.entity, archivedAt: null }, select: { id: true } });
			if (new Set(input.ids).size !== input.ids.length || rows.length !== input.ids.length) throw new BadRequestException("That order names a field which is not on this record type or is archived.");
			for (const [position, id] of input.ids.entries()) await tx.fieldDefinition.update({ where: { id }, data: { position } });
			return (await tx.fieldDefinition.findMany({ where: { entity: input.entity, archivedAt: null }, include: WITH_OPTIONS, orderBy: { position: "asc" } })).map(serializeField);
		});
	}

	async status(id: string, archived: boolean, userId: string) {
		return this.write(userId, async (tx) => {
			const before = await this.definition(tx, id);
			if (Boolean(before.archivedAt) === archived) return serializeField(before);
			return serializeField(await tx.fieldDefinition.update({ where: { id }, data: { archivedAt: archived ? new Date() : null }, include: WITH_OPTIONS }));
		});
	}

	async delete(id: string, userId: string) {
		return this.write(userId, async (tx) => {
			const before = await this.definition(tx, id);
			if (!before.archivedAt) throw new BadRequestException("Archive the field before deleting it.");
			if (await tx.fieldValue.count({ where: { fieldId: id } })) throw new ConflictException("This field has historical values. Keep it archived.");
			await tx.fieldDefinition.delete({ where: { id } });
			return { id };
		}, true);
	}

	async backfill(id: string, userId: string) {
		const queued = await this.write(userId, async (tx) => {
			requireApiAiEnabled();
			const field = await this.definition(tx, id);
			if (!field.agentFilled || field.archivedAt) throw new BadRequestException("Your agents do not fill this field, so there is nothing to run.");
			return this.queue(tx, field, "Asked to fill the rest");
		});
		if (queued) this.agent.drainAfterCommit();
		return { queued };
	}
}
