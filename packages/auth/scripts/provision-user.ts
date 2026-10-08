import "@crm/env/load";

import { db } from "@crm/db";
import { createInterface } from "node:readline/promises";
import { ZodError } from "zod";
import { ProvisionError, provisionUser } from "../src/provision-user";

async function hiddenPassword(): Promise<string> {
	if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Use --stdin-json for non-interactive input.");
	process.stdout.write("Contraseña (12 caracteres o más): ");
	process.stdin.setRawMode(true);
	process.stdin.resume();
	return new Promise((resolve, reject) => {
		let value = "";
		const finish = (error?: Error) => {
			process.stdin.off("data", onData);
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdout.write("\n");
			if (error) reject(error); else resolve(value);
		};
		const onData = (chunk: Buffer) => {
			for (const character of chunk.toString("utf8")) {
				if (character === "\u0003") return finish(new Error("Cancelled."));
				if (character === "\r" || character === "\n") return finish();
				if (character === "\u007f" || character === "\b") value = Array.from(value).slice(0, -1).join("");
				else if (character >= " ") value += character;
			}
		};
		process.stdin.on("data", onData);
	});
}

async function readInput(): Promise<unknown> {
	if (process.argv.includes("--stdin-json")) {
		let input = "";
		for await (const chunk of process.stdin) input += chunk.toString();
		return JSON.parse(input);
	}
	const prompt = createInterface({ input: process.stdin, output: process.stdout });
	const name = await prompt.question("Nombre: ");
	const email = await prompt.question("Correo autorizado: ");
	const bootstrap = process.argv.includes("--bootstrap");
	const workspaceName = bootstrap ? await prompt.question("Nombre de la empresa: ") : undefined;
	const role = bootstrap ? "owner" : await prompt.question("Rol (admin/member): ");
	prompt.close();
	const password = await hiddenPassword();
	return { name, email, password, role, bootstrap, workspaceName: workspaceName || "CRM Corporativo" };
}

try {
	const result = await provisionUser(await readInput());
	console.log(`Cuenta creada. Rol: ${result.role}. Inicia sesión en la aplicación.`);
} catch (error) {
	const safeMessage = error instanceof ProvisionError ? error.message : error instanceof ZodError ? "Invalid account fields. Password must contain 12–128 characters." : "Provisioning failed. Check database access and the input format.";
	console.error(safeMessage);
	process.exitCode = 1;
} finally {
	await db.$disconnect();
}
