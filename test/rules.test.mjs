import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { loadRules } from "../dist/rules.js";

const examplesDir = new URL("../examples/", import.meta.url);

async function tempFile(content) {
  const dir = await mkdtemp(join(tmpdir(), "jev-mcp-"));
  const path = join(dir, "rules.yaml");
  await writeFile(path, content);
  return path;
}

describe("loadRules", () => {
  it("loads every example rule set", async () => {
    const files = (await readdir(examplesDir)).filter((f) => f.endsWith(".yaml"));
    assert.ok(files.length > 0);
    for (const file of files) {
      const set = await loadRules(fileURLToPath(new URL(file, examplesDir)));
      assert.ok(Object.keys(set.rules).length > 0, `${file} has no rules`);
    }
  });

  it("fills in defaults", async () => {
    const set = await loadRules(await tempFile("rules:\n  a:\n    type: yes_no\n    question: Q?\n    yes_when: y\n    no_when: n\n"));
    assert.deepEqual(set.defaults, { threshold: 0.5, margin: 0.1, min_confidence: 0.6 });
  });

  it("rejects invalid rules with a readable error", async () => {
    const path = await tempFile("rules:\n  a:\n    type: yes_no\n    question: Q?\n");
    await assert.rejects(loadRules(path), /Invalid rules file/);
  });

  it("throws when the file is missing, or returns undefined when optional", async () => {
    const missing = join(tmpdir(), "jev-mcp-does-not-exist.yaml");
    await assert.rejects(loadRules(missing), /Rules file not found/);
    assert.equal(await loadRules(missing, { optional: true }), undefined);
  });
});
