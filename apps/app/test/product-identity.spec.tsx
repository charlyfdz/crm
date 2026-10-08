import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import Logo from "@crm/ui/components/logo";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function source(relativePath: string): ts.SourceFile {
	const url = new URL(relativePath, import.meta.url);
	return ts.createSourceFile(
		url.pathname,
		readFileSync(url, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
}

function nodes<T extends ts.Node>(
	root: ts.Node,
	match: (node: ts.Node) => node is T,
): T[] {
	const result: T[] = [];
	function visit(node: ts.Node) {
		if (match(node)) result.push(node);
		ts.forEachChild(node, visit);
	}
	visit(root);
	return result;
}

function variable(file: ts.SourceFile, name: string): ts.Expression {
	const declaration = nodes(file, ts.isVariableDeclaration).find(
		(node) => ts.isIdentifier(node.name) && node.name.text === name,
	);
	if (!declaration?.initializer) throw new Error(`Missing variable: ${name}`);
	return declaration.initializer;
}

function property(
	object: ts.ObjectLiteralExpression,
	name: string,
): ts.Expression {
	const field = object.properties.find(
		(node) =>
			ts.isPropertyAssignment(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === name,
	);
	if (!field || !ts.isPropertyAssignment(field)) {
		throw new Error(`Missing property: ${name}`);
	}
	return field.initializer;
}

function textValue(expression: ts.Expression): string {
	if (!ts.isStringLiteral(expression))
		throw new Error("Expected a text literal");
	return expression.text;
}

function attributeValues(file: ts.SourceFile, name: string): string[] {
	return nodes(file, ts.isJsxAttribute)
		.filter((node) => node.name.getText(file) === name)
		.map((node) => {
			if (!node.initializer || !ts.isStringLiteral(node.initializer)) {
				throw new Error(`Expected a text attribute: ${name}`);
			}
			return node.initializer.text;
		});
}

const rail = source("../components/app-icon-rail.tsx");
const layout = source("../app/layout.tsx");
const logoSource = source("../../../packages/ui/src/components/logo.tsx");
const expectedNavigation = [
	{ id: "overview", title: "Resumen", href: "/", match: "exact" },
	{ id: "chat", title: "Conversaciones", href: "/chat", match: "prefix" },
	{ id: "companies", title: "Empresas", href: "/companies", match: "prefix" },
	{ id: "contacts", title: "Contactos", href: "/contacts", match: "prefix" },
	{ id: "deals", title: "Oportunidades", href: "/deals", match: "prefix" },
	{
		id: "settings",
		title: "Configuración",
		href: "/settings",
		match: "prefix",
	},
];
const network = spyOn(globalThis, "fetch");

beforeAll(() => {
	network.mockImplementation(
		Object.assign(
			() => {
				throw new Error("Network is forbidden in identity tests");
			},
			{
				preconnect: () => {
					throw new Error("Network preconnect is forbidden in identity tests");
				},
			},
		),
	);
});

afterAll(() => {
	const calls = network.mock.calls.length;
	network.mockRestore();
	expect(calls).toBe(0);
});

describe("neutral product identity", () => {
	it("renders a named neutral vector instead of the upstream mark", () => {
		const markup = renderToStaticMarkup(<Logo />);
		expect(markup).toContain('aria-label="CRM Corporativo"');
		expect(markup).toContain('role="img"');
		expect(markup).toContain('focusable="false"');
		expect(markup).toContain('viewBox="0 0 32 32"');
		expect(markup).toContain('fill="currentColor"');
		expect(markup).not.toContain("Comp AI");
		expect(markup).not.toContain("384 99.548");
		expect(markup).not.toContain("S&amp;F");
	});

	it("keeps caller dimensions, layout classes, and a contextual accessible name", () => {
		const markup = renderToStaticMarkup(
			<Logo
				width={20}
				height={20}
				className="size-5"
				aria-label="Volver al resumen"
			/>,
		);
		expect(markup).toContain('width="20"');
		expect(markup).toContain('height="20"');
		expect(markup).toContain('class="size-5"');
		expect(markup).toContain('aria-label="Volver al resumen"');
	});

	for (const hidden of [true, "true"] as const) {
		it(`keeps decorative ${typeof hidden} logos out of the accessibility tree`, () => {
			const markup = renderToStaticMarkup(<Logo aria-hidden={hidden} />);
			expect(markup).toContain('aria-hidden="true"');
			expect(markup).not.toContain("aria-label=");
			expect(markup).not.toContain('role="img"');
		});
	}

	for (const hidden of [false, "false"] as const) {
		it(`retains the product name for non-decorative ${typeof hidden} logos`, () => {
			const markup = renderToStaticMarkup(<Logo aria-hidden={hidden} />);
			expect(markup).toContain('aria-label="CRM Corporativo"');
			expect(markup).toContain('role="img"');
		});
	}

	it("renders deterministically without providers or external images", () => {
		const markup = renderToStaticMarkup(<Logo />);
		expect(markup).toBe(renderToStaticMarkup(<Logo />));
		expect(markup).not.toContain("<image");
		expect(markup).not.toContain("<img");
		expect(markup).not.toContain("href=");
	});

	it("uses the already installed Carbon icon family without server imports", () => {
		const imports = nodes(logoSource, ts.isImportDeclaration).map((node) =>
			textValue(node.moduleSpecifier),
		);
		expect(imports).toEqual(["@carbon/icons-react/es/Collaborate", "react"]);
	});

	it("keeps existing metadata and sets the root language to Spanish", () => {
		const metadata = variable(layout, "metadata");
		if (!ts.isObjectLiteralExpression(metadata))
			throw new Error("Missing metadata");
		const title = property(metadata, "title");
		if (!ts.isObjectLiteralExpression(title)) throw new Error("Missing title");
		expect(textValue(property(title, "default"))).toBe("CRM Corporativo");
		expect(textValue(property(title, "template"))).toBe("%s · CRM Corporativo");
		expect(textValue(property(metadata, "description"))).toBe(
			"Gestión privada de clientes, contactos y oportunidades comerciales.",
		);
		expect(attributeValues(layout, "lang")).toEqual(["es"]);
	});

	it("reaches the existing header and access shell through their shared logo import", () => {
		for (const path of [
			"../components/app-header.tsx",
			"../components/auth-shell.tsx",
		]) {
			const imports = nodes(source(path), ts.isImportDeclaration).map((node) =>
				textValue(node.moduleSpecifier),
			);
			expect(imports).toContain("@crm/ui/components/logo");
		}
	});
});

describe("Spanish business navigation source contract", () => {
	it("keeps existing routes and maps every section to a Spanish label", () => {
		const items = variable(rail, "ITEMS");
		if (!ts.isArrayLiteralExpression(items))
			throw new Error("Missing navigation");
		const actual = items.elements.map((item) => {
			if (!ts.isObjectLiteralExpression(item))
				throw new Error("Invalid navigation item");
			return {
				id: textValue(property(item, "id")),
				title: textValue(property(item, "title")),
				href: textValue(property(item, "href")),
				match: textValue(property(item, "match")),
			};
		});
		expect(actual).toEqual(expectedNavigation);
	});

	it("preserves the agents route inside the conversations section", () => {
		const items = variable(rail, "ITEMS");
		if (!ts.isArrayLiteralExpression(items))
			throw new Error("Missing navigation");
		const chat = items.elements.find(
			(item) =>
				ts.isObjectLiteralExpression(item) &&
				textValue(property(item, "id")) === "chat",
		);
		if (!chat || !ts.isObjectLiteralExpression(chat))
			throw new Error("Missing chat");
		const related = property(chat, "related");
		if (!ts.isArrayLiteralExpression(related))
			throw new Error("Missing related routes");
		expect(related.elements.map(textValue)).toEqual(["/agents"]);
	});

	it("selects chat transitions and the mobile chat drawer by ID, not translated text", () => {
		const comparisons = nodes(rail, ts.isBinaryExpression).filter(
			(node) =>
				node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken,
		);
		expect(
			comparisons.filter(
				(node) =>
					node.left.getText(rail) === "item.id" &&
					node.right.getText(rail) === '"chat"',
			),
		).toHaveLength(2);
		expect(
			comparisons.some((node) => node.left.getText(rail) === "item.title"),
		).toBe(false);
	});

	it("names primary landmarks and both close actions in Spanish", () => {
		expect(attributeValues(rail, "aria-label")).toEqual([
			"Navegación principal",
			"Navegación principal",
			"Navegación principal",
			"Cerrar navegación",
			"Cerrar navegación",
			"Navegación principal",
		]);
	});

	it("names both mobile drawers in Spanish and supplies explicit close buttons", () => {
		const titles = nodes(rail, ts.isJsxElement)
			.filter(
				(node) => node.openingElement.tagName.getText(rail) === "SheetTitle",
			)
			.map((node) =>
				node.children
					.map((child) => child.getText(rail))
					.join("")
					.trim(),
			);
		expect(titles).toEqual([
			"Navegación y conversaciones con agentes",
			"Navegación principal",
		]);
		const closeDefaults = nodes(rail, ts.isJsxAttribute).filter(
			(node) => node.name.getText(rail) === "showCloseButton",
		);
		expect(closeDefaults).toHaveLength(2);
		for (const attribute of closeDefaults)
			expect(attribute.initializer?.getText(rail)).toBe("{false}");
	});

	it("reuses the item title for icon-only, visible, fallback, and tooltip labels", () => {
		const expressions = nodes(rail, ts.isJsxExpression).filter(
			(node) => node.expression?.getText(rail) === "item.title",
		);
		expect(expressions).toHaveLength(5);
		expect(
			nodes(rail, ts.isJsxAttribute).filter(
				(node) =>
					node.name.getText(rail) === "className" &&
					node.initializer &&
					ts.isStringLiteral(node.initializer) &&
					node.initializer.text === "sr-only",
			),
		).toHaveLength(4);
	});
});
