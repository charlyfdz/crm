import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { checkDelivery, localLinks, withinRepository } from "./check.mjs";

test("reads local links without treating remote links as runtime checks", () => {
	assert.deepEqual(
		localLinks(
			"[a](../a.md) [b](<with space.md>) [web](https://example.test) [anchor](#one)",
		),
		["../a.md", "with space.md"],
	);
});
test("refuses targets outside the intended repository", () => {
	const root = resolve("docs/delivery");
	assert.equal(withinRepository(resolve(root, "inside.md"), root), true);
	assert.equal(withinRepository(resolve(root, "../outside.md"), root), false);
});
test("validates documentation without asserting business execution", async () => {
	const result = await checkDelivery();
	assert.ok(result.documents > 10);
	assert.ok(result.localLinks > 10);
	assert.equal(result.runtimeExecuted, false);
});
