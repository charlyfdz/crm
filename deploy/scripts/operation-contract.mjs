import { resolve } from "node:path";
import { CONFIG } from "./config.mjs";

export function operationPlan(
	command,
	archive,
	env,
	targetDatabase,
	timestamp = Date.now(),
) {
	if (
		!["backup", "restore-drill", "restore-new"].includes(command) ||
		!archive
	) {
		throw new Error(
			"Use operations.mjs backup|restore-drill|restore-new ARCHIVE [NEW_DATABASE] [--execute]",
		);
	}
	const database =
		command === "backup"
			? env.POSTGRES_DB
			: command === "restore-drill"
				? `crm_restore_${timestamp}_test`
				: targetDatabase;
	if (
		!/^[a-z][a-z0-9_]{0,62}$/.test(database ?? "") ||
		CONFIG.operations.protectedDatabases.includes(database)
	) {
		throw new Error("Operation database needs a safe non-system identifier");
	}
	if (command !== "backup" && database === env.POSTGRES_DB)
		throw new Error("Restore never overwrites the source database");
	return {
		command,
		archive: resolve(archive),
		database,
		sourceUnchanged: true,
		steps:
			command === "backup"
				? [
						"verify-quiescence",
						"table-counts",
						"custom-format-dump",
						"checksum-manifest",
					]
				: [
						"verify-quiescence",
						"verify-checksum-and-release",
						"create-new-database",
						"transactional-restore",
						"compare-table-counts",
						"schema-check",
						"application-grants",
						"verification-receipt",
					],
	};
}

export function validateManifest(manifest, env, sha256) {
	if (
		manifest.formatVersion !== CONFIG.operations.manifestVersion ||
		!/^[a-f0-9]{64}$/.test(manifest.sha256 ?? "")
	) {
		throw new Error("Backup manifest has an unsupported format");
	}
	if (manifest.sha256 !== sha256)
		throw new Error("Backup checksum does not match");
	if (manifest.installation !== env.COMPOSE_PROJECT_NAME)
		throw new Error("Backup belongs to another installation");
	if (manifest.release !== env.CRM_VERSION)
		throw new Error(
			"Restore requires the exact source release before schema verification",
		);
	if (typeof manifest.rowCounts !== "string" || !Array.isArray(manifest.images))
		throw new Error("Backup manifest is incomplete");
	return true;
}

export function assertQuiescent(services) {
	if (!services.includes("postgres"))
		throw new Error("PostgreSQL must run before this operation");
	if (
		services.some((service) => !CONFIG.operations.nonWriters.includes(service))
	) {
		throw new Error("Stop all application services before this operation");
	}
}
