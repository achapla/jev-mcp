// Thin client for the OpenRouter Decisions API (Jev by TypeSafe).
// Docs: https://openrouter.ai/docs/guides/community/jev-tutorial

const API_URL = "https://openrouter.ai/api/alpha/decisions";
const DEFAULT_MODEL = "~typesafe/jev-latest";
const REQUEST_TIMEOUT_MS = 60_000;

export type JevQuestion =
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };

export interface JevResponse {
  id: string;
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number; cost: number };
}

export type JevState = string | string[] | Record<string, unknown>;

export async function askJev(state: JevState, questions: Record<string, JevQuestion>): Promise<JevResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Optional OpenRouter app attribution headers.
      "HTTP-Referer": "https://github.com/achapla/jev-mcp",
      "X-Title": "jev-mcp",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: process.env.JEV_MODEL || DEFAULT_MODEL,
      state: typeof state === "string" ? [state] : state,
      questions,
    }),
  });

  const body = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new Error(`Jev API error ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
  return body as JevResponse;
}
