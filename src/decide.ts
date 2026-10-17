// Turns rules into Jev questions, sends them in one request, and adds yes/no + uncertain flags.

import { askJev, type JevQuestion, type JevState } from "./jev.js";
import { defaultsSchema, type Defaults, type Rule } from "./rules.js";

export type Decision =
  | {
      type: "yes_no";
      question: string;
      decision: "yes" | "no";
      probability: number;
      threshold: number;
      uncertain: boolean;
    }
  | {
      type: "choice";
      question: string;
      decision: string;
      confidence: number;
      probabilities: Record<string, number>;
      uncertain: boolean;
    };

export interface DecideResult {
  decisions: Record<string, Decision>;
  model: string;
  cost_usd: number;
}

function toQuestion(rule: Rule): JevQuestion {
  if (rule.type === "yes_no") {
    return { type: "noul", instructions: rule.question, criteria: { true: rule.yes_when, false: rule.no_when } };
  }
  if (Object.keys(rule.options).length < 2) {
    throw new Error(`Choice rule "${rule.question}" needs at least 2 options`);
  }
  return { type: "choice", instructions: rule.question, criteria: rule.options };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export async function decide(
  state: JevState,
  rules: Record<string, Rule>,
  defaults: Defaults = defaultsSchema.parse({}),
): Promise<DecideResult> {
  const ids = Object.keys(rules);
  if (ids.length === 0) throw new Error("No rules to evaluate");

  const questions = Object.fromEntries(ids.map((id) => [id, toQuestion(rules[id])]));
  const res = await askJev(state, questions);

  const decisions: Record<string, Decision> = {};
  for (const id of ids) {
    const rule = rules[id];
    const answer = res.answers?.[id];
    if (!answer) throw new Error(`Jev returned no answer for "${id}"`);

    if (rule.type === "yes_no" && answer.type === "noul") {
      const threshold = rule.threshold ?? defaults.threshold;
      const margin = rule.margin ?? defaults.margin;
      decisions[id] = {
        type: "yes_no",
        question: rule.question,
        decision: answer.noul >= threshold ? "yes" : "no",
        probability: round(answer.noul),
        threshold,
        uncertain: Math.abs(answer.noul - threshold) < margin,
      };
    } else if (rule.type === "choice" && answer.type === "choice") {
      decisions[id] = {
        type: "choice",
        question: rule.question,
        decision: answer.choice,
        confidence: round(answer.confidence),
        probabilities: Object.fromEntries(Object.entries(answer.probabilities).map(([k, v]) => [k, round(v)])),
        uncertain: answer.confidence < (rule.min_confidence ?? defaults.min_confidence),
      };
    } else {
      throw new Error(`Unexpected answer type "${answer.type}" for rule "${id}"`);
    }
  }

  return { decisions, model: res.model, cost_usd: res.usage?.cost ?? 0 };
}
