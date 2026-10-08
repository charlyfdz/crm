import { RESOURCE_POLICY, validateResources } from "./resources.mjs";

export const ADMISSION = Object.freeze({
	freshnessMs: 24 * 60 * 60 * 1000,
	guestDiskMinimumGiB: 40,
	hostDiskProjectedMinimumGiB: 150,
	checks: [
		"completeVersion",
		"businessAcceptance",
		"security",
		"containerBuild",
		"containerSmoke",
		"restoreSmoke",
		"filesBackup",
		"privateHttps",
		"effectiveLimits",
		"rollback",
	],
	imageVariables: [
		"CRM_NODE_IMAGE",
		"CRM_BUN_IMAGE",
		"CRM_POSTGRES_IMAGE",
		"CRM_REDIS_IMAGE",
	],
});

export function validateAdmission(
	record,
	env,
	agent = false,
	now = Date.now(),
) {
	if (
		record.schemaVersion !== 1 ||
		record.service !== "crm-corporativo" ||
		record.company !== "Corporativo S&F"
	) {
		throw new Error("Admission needs the Corporativo S&F pilot record");
	}
	if (
		record.infrastructureOwner !== "Personal-Carlos" ||
		record.target !== "homelab/paas-control/Coolify"
	) {
		throw new Error(
			"Admission needs the approved target and separate infrastructure owner",
		);
	}
	if (
		record.deploymentAuthorized !== true ||
		!record.approvalEvidence?.trim()
	) {
		throw new Error("Deployment authorization remains pending");
	}
	if (ADMISSION.checks.some((key) => record.checks?.[key] !== "passed"))
		throw new Error("Release acceptance checks remain pending");
	if (
		record.exposure !== "private-https-tailnet" ||
		record.lifecycleAccepted !== true
	) {
		throw new Error(
			"Private exposure and service lifecycle acceptance remain required",
		);
	}
	if (
		record.origins?.app !== env.APP_URL ||
		record.origins?.api !== env.API_URL ||
		(record.origins?.cookieDomain ?? "") !== (env.AUTH_COOKIE_DOMAIN ?? "")
	) {
		throw new Error("Origins must match the accepted private routing record");
	}
	for (const key of ADMISSION.imageVariables) {
		if (!/@sha256:[a-f0-9]{64}$/.test(env[key] ?? ""))
			throw new Error(`${key} needs a verified image digest before admission`);
	}
	const measured = record.capacity;
	const age = now - Date.parse(measured?.recordedAt ?? "");
	if (
		!Number.isFinite(age) ||
		age < 0 ||
		age > ADMISSION.freshnessMs ||
		measured.synthetic !== false ||
		!measured.evidence?.trim()
	) {
		throw new Error(
			"Admission needs current measured capacity evidence, not a synthetic fixture",
		);
	}
	for (const key of [
		"otherNoncoreMemoryBytes",
		"otherNoncoreCpuLimits",
		"guestFreeGiB",
		"projectedHostFreeGiB",
	]) {
		if (!Number.isFinite(measured[key]) || measured[key] < 0)
			throw new Error(`Capacity field ${key} is missing`);
	}
	const { phases } = validateResources(env, agent);
	if (
		phases.some(
			(phase) =>
				phase.memory + measured.otherNoncoreMemoryBytes >
					RESOURCE_POLICY.sharedMemoryBytes ||
				phase.cpu + measured.otherNoncoreCpuLimits > RESOURCE_POLICY.sharedCpu,
		)
	) {
		throw new Error("CRM plus other workloads exceeds the shared pool");
	}
	if (
		measured.guestFreeGiB < ADMISSION.guestDiskMinimumGiB ||
		measured.projectedHostFreeGiB < ADMISSION.hostDiskProjectedMinimumGiB
	) {
		throw new Error("Disk admission thresholds fail");
	}
	if (
		record.backup?.restoreVerified !== true ||
		!record.backup.locationEvidence?.trim() ||
		!record.backup.rpo?.trim() ||
		!record.backup.rto?.trim() ||
		record.backup.usesRejectedDisk !== false
	) {
		throw new Error(
			"Backup location, restore proof, RPO, and RTO remain required. Never use the rejected disk",
		);
	}
	return true;
}
