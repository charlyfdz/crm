export const RESOURCE_POLICY = Object.freeze({
	sharedMemoryBytes: 2.5 * 1024 ** 3,
	sharedCpu: 3,
	runtime: ["POSTGRES", "REDIS", "API", "APP", "CRON"],
	maintenance: ["POSTGRES", "REDIS", "MIGRATE"],
	redisHeadroomRatio: 0.75,
});

export function memoryBytes(value) {
	const match = /^(\d+)([bkmg])?$/i.exec(value ?? "");
	if (!match)
		throw new Error(
			"Memory limits need a positive integer with optional b, k, m, or g",
		);
	const bytes =
		Number(match[1]) * 1024 ** "bkmg".indexOf((match[2] ?? "b").toLowerCase());
	if (!Number.isSafeInteger(bytes) || bytes <= 0)
		throw new Error("Memory limits cannot be zero or unbounded");
	return bytes;
}

export function cpuCount(value) {
	if (!/^\d+(\.\d+)?$/.test(value ?? ""))
		throw new Error("CPU limits need a positive decimal");
	const count = Number(value);
	if (!Number.isFinite(count) || count <= 0)
		throw new Error("CPU limits cannot be zero or unbounded");
	return count;
}

export function validateResources(env, agent = false) {
	const runtime = [...RESOURCE_POLICY.runtime, ...(agent ? ["AGENT"] : [])];
	const limits = Object.fromEntries(
		[...new Set([...runtime, ...RESOURCE_POLICY.maintenance])].map((name) => [
			name,
			{
				memory: memoryBytes(env[`CRM_${name}_MEMORY_LIMIT`]),
				cpu: cpuCount(env[`CRM_${name}_CPU_LIMIT`]),
			},
		]),
	);
	const phases = [runtime, RESOURCE_POLICY.maintenance].map((names) =>
		names.reduce(
			(sum, name) => ({
				memory: sum.memory + limits[name].memory,
				cpu: sum.cpu + limits[name].cpu,
			}),
			{ memory: 0, cpu: 0 },
		),
	);
	if (
		phases.some(
			(sum) =>
				sum.memory > RESOURCE_POLICY.sharedMemoryBytes ||
				sum.cpu > RESOURCE_POLICY.sharedCpu + Number.EPSILON,
		)
	) {
		throw new Error(
			"CRM limits exceed the entire shared pool. Reassess placement before admission",
		);
	}
	if (
		memoryBytes(env.CRM_REDIS_MAXMEMORY) >
		limits.REDIS.memory * RESOURCE_POLICY.redisHeadroomRatio
	) {
		throw new Error("Redis cache needs container memory headroom");
	}
	return { phases, capacityAdmission: false };
}
