#!/usr/bin/env node
// MCP server: rule-based decisions powered by Jev (OpenRouter Decisions API).

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { decide } from "./decide.js";
import { choiceRuleSchema, loadRules, ruleSchema, yesNoRuleSchema, type Defaults, type Rule } from "./rules.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const server = new McpServer({ name: "jev-mcp", version });

const contextSchema = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .describe(
    "Everything needed to decide, as plain text or a JSON object. " +
      "Examples: a GitHub issue (title, body, labels, comments), an email, a social media post, a support ticket, a document, the current state of a task.",
  );

const rulesFileSchema = z
  .string()
  .optional()
  .describe("Path to a rules YAML file. Default: JEV_RULES_FILE env var, then .jev/rules.yaml in the working directory.");

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

server.registerTool(
  "evaluate_rules",
  {
    title: "Evaluate rules",
    description:
      "Decide several rules at once (one Jev call) for the given context. Uses rules from the rules file and/or custom rules. " +
      "Each yes/no result has decision, probability and 'uncertain'; each choice result has decision, confidence and 'uncertain'. " +
      "When 'uncertain' is true, ask the user instead of acting.",
    inputSchema: {
      context: contextSchema,
      rule_ids: z
        .array(z.string())
        .optional()
        .describe("Which rules from the file to run. Omit to run all. Pass [] to run only custom_rules."),
      custom_rules: z
        .record(z.string(), ruleSchema)
        .optional()
        .describe("Extra rules defined now, keyed by id. Same format as rules in the file."),
      rules_file: rulesFileSchema,
    },
  },
  async ({ context, rule_ids, custom_rules, rules_file }) => {
    try {
      const rules: Record<string, Rule> = {};
      let defaults: Defaults | undefined;
      const hasCustom = Object.keys(custom_rules ?? {}).length > 0;

      if (!rule_ids || rule_ids.length > 0) {
        // The rules file is optional only when the caller sent custom rules and did not ask for file rules.
        const set = await loadRules(rules_file, { optional: hasCustom && !rule_ids && !rules_file });
        if (set) {
          defaults = set.defaults;
          for (const id of rule_ids ?? Object.keys(set.rules)) {
            if (!set.rules[id]) throw new Error(`Rule "${id}" not found in ${set.path}`);
            rules[id] = set.rules[id];
          }
        }
      }
      for (const [id, rule] of Object.entries(custom_rules ?? {})) {
        if (rules[id]) throw new Error(`Custom rule id "${id}" clashes with a file rule`);
        rules[id] = rule;
      }
      return ok(await decide(context, rules, defaults));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "ask_yes_no",
  {
    title: "Ask a yes/no question",
    description:
      "Decide one yes/no question for the given context, e.g. 'Should this issue be split into sub-issues?' or 'Should I reply to this email today?'. " +
      "Returns decision, probability of yes, and 'uncertain'. When 'uncertain' is true, ask the user instead of acting.",
    inputSchema: { context: contextSchema, ...yesNoRuleSchema.omit({ type: true }).shape },
  },
  async ({ context, ...rule }) => {
    try {
      const res = await decide(context, { answer: { type: "yes_no", ...rule } });
      return ok({ ...res.decisions.answer, model: res.model, cost_usd: res.cost_usd });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "ask_choice",
  {
    title: "Pick one option",
    description:
      "Decide one multiple-choice question for the given context, e.g. 'How big is this work?' or 'What is the tone of this comment?'. " +
      "Returns the chosen option, confidence, per-option probabilities, and 'uncertain'. When 'uncertain' is true, ask the user instead of acting.",
    inputSchema: { context: contextSchema, ...choiceRuleSchema.omit({ type: true }).shape },
  },
  async ({ context, ...rule }) => {
    try {
      const res = await decide(context, { answer: { type: "choice", ...rule } });
      return ok({ ...res.decisions.answer, model: res.model, cost_usd: res.cost_usd });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "list_rules",
  {
    title: "List rules",
    description: "Show the rules defined in the rules file, so you know which rule_ids exist.",
    inputSchema: { rules_file: rulesFileSchema },
  },
  async ({ rules_file }) => {
    try {
      return ok(await loadRules(rules_file));
    } catch (err) {
      return fail(err);
    }
  },
);

await server.connect(new StdioServerTransport());
