import { access, readdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const kit = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(kit, "../..");

export function localLinks(source) {
	return [...source.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))\)/g)]
		.map((match) => match[1] ?? match[2])
		.filter((link) => link && !/^(?:https?:|mailto:|#)/i.test(link));
}

export function withinRepository(path, root = repository) {
	const location = relative(root, path);
	return (
		location !== ".." &&
		!location.startsWith("../") &&
		!location.startsWith("..\\") &&
		!isAbsolute(location)
	);
}

async function documents(directory) {
	const rows = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.isSymbolicLink())
			throw new Error("The delivery kit does not follow symbolic links.");
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) rows.push(...(await documents(path)));
		else if (entry.isFile() && entry.name.endsWith(".md")) rows.push(path);
	}
	return rows;
}

export async function checkDelivery() {
	const files = await documents(kit);
	const missing = [];
	let links = 0;
	for (const file of files) {
		for (const link of localLinks(await readFile(file, "utf8"))) {
			links++;
			const target = resolve(
				dirname(file),
				decodeURIComponent(link.split("#")[0]),
			);
			if (!withinRepository(target))
				throw new Error("A delivery link leaves the repository.");
			try {
				await access(target);
			} catch {
				missing.push(`${relative(kit, file)} -> ${link}`);
			}
		}
	}
	const blank = JSON.parse(
		await readFile(
			resolve(kit, "templates/configuracion-empresa.blank.json"),
			"utf8",
		),
	);
	if (!Object.values(blank).every((value) => value === null))
		throw new Error("The company configuration template must remain blank.");
	const business = JSON.parse(
		await readFile(resolve(kit, "fixtures/negocio-sintetico.json"), "utf8"),
	);
	if (
		business.synthetic !== true ||
		business.executionResult !== null ||
		business.clientAcceptance !== null
	)
		throw new Error(
			"Synthetic material does not assert execution or client acceptance.",
		);
	if (missing.length)
		throw new Error(`Missing local delivery links:\n${missing.join("\n")}`);
	return {
		documents: files.length,
		localLinks: links,
		synthetic: true,
		runtimeExecuted: false,
	};
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		process.stdout.write(`${JSON.stringify(await checkDelivery())}\n`);
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : "Delivery validation failed."}\n`,
		);
		process.exitCode = 1;
	}
}
