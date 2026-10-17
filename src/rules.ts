// Rule definitions: loaded from a YAML file or passed inline by the agent.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

export const yesNoRuleSchema = z.object({
  type: z.literal("yes_no"),
  question: z.string().describe("The question to decide, e.g. 'Should this issue be split into sub-issues?'"),
  yes_when: z.string().describe("What 'yes' means"),
  no_when: z.string().describe("What 'no' means"),
  threshold: z.number().min(0).max(1).optional().describe("Probability at or above this is 'yes'"),
  margin: z.number().min(0).max(0.5).optional().describe("Mark 'uncertain' when probability is within this distance of the threshold"),
});

export const choiceRuleSchema = z.object({
  type: z.literal("choice"),
  question: z.string().describe("The question to decide, e.g. 'How big is this work?'"),
  options: z.record(z.string(), z.string()).describe("Option name -> what it means. At least 2."),
  min_confidence: z.number().min(0).max(1).optional().describe("Mark 'uncertain' when confidence is below this"),
});

export const ruleSchema = z.discriminatedUnion("type", [yesNoRuleSchema, choiceRuleSchema]);

export const defaultsSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.5),
  margin: z.number().min(0).max(0.5).default(0.1),
  min_confidence: z.number().min(0).max(1).default(0.6),
});

const rulesFileSchema = z.object({
  defaults: defaultsSchema.partial().optional(),
  rules: z.record(z.string(), ruleSchema),
});

export type Rule = z.infer<typeof ruleSchema>;
export type Defaults = z.infer<typeof defaultsSchema>;
export interface RuleSet {
  path: string;
  defaults: Defaults;
  rules: Record<string, Rule>;
}

/** Resolve order: explicit path -> JEV_RULES_FILE -> .jev/rules.yaml in the working directory. */
export function resolveRulesPath(path?: string): string {
  return resolve(path || process.env.JEV_RULES_FILE || ".jev/rules.yaml");
}

export async function loadRules(path?: string): Promise<RuleSet>;
export async function loadRules(path: string | undefined, opts: { optional: boolean }): Promise<RuleSet | undefined>;
export async function loadRules(path?: string, opts?: { optional: boolean }): Promise<RuleSet | undefined> {
  const fullPath = resolveRulesPath(path);
  let text: string;
  try {
    text = await readFile(fullPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      if (opts?.optional) return undefined;
      throw new Error(`Rules file not found: ${fullPath}`);
    }
    throw err;
  }
  const parsed = rulesFileSchema.safeParse(parse(text));
  if (!parsed.success) {
    throw new Error(`Invalid rules file ${fullPath}:\n${z.prettifyError(parsed.error)}`);
  }
  return {
    path: fullPath,
    defaults: defaultsSchema.parse(parsed.data.defaults ?? {}),
    rules: parsed.data.rules,
  };
}
