import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const rulesPath = fileURLToPath(new URL("../examples/github-issues.yaml", import.meta.url));

describe("MCP server", () => {
  const client = new Client({ name: "test", version: "1.0.0" });

  before(async () => {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [serverPath],
        env: { ...process.env, JEV_RULES_FILE: rulesPath, OPENROUTER_API_KEY: "" },
      }),
    );
  });
  after(() => client.close());

  it("lists all tools", async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["ask_choice", "ask_yes_no", "evaluate_rules", "list_rules"]);
  });

  it("list_rules returns rules from JEV_RULES_FILE", async () => {
    const res = await client.callTool({ name: "list_rules", arguments: {} });
    assert.ok(JSON.parse(res.content[0].text).rules.split_issue);
  });

  it("evaluate_rules reports unknown rule ids", async () => {
    const res = await client.callTool({ name: "evaluate_rules", arguments: { context: "x", rule_ids: ["nope"] } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /Rule "nope" not found/);
  });
});
