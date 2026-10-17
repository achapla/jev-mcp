import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { decide } from "../dist/decide.js";

const realFetch = globalThis.fetch;
let lastRequest;

function mockJev(answers, status = 200) {
  globalThis.fetch = async (url, init) => {
    lastRequest = { url, body: JSON.parse(init.body), headers: init.headers };
    const body = status === 200
      ? { id: "gen-test", model: "typesafe/jev-test", answers, usage: { input_tokens: 10, output_tokens: 0, cost: 0.00001 } }
      : { error: { message: "Bad request", code: status } };
    return new Response(JSON.stringify(body), { status });
  };
}

const yesNo = { type: "yes_no", question: "Q?", yes_when: "yes case", no_when: "no case" };
const choice = { type: "choice", question: "Size?", options: { small: "s", large: "l" } };

describe("decide", () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "test-key"; });
  afterEach(() => { globalThis.fetch = realFetch; });

  it("maps rules to Jev questions and sends text state as an array", async () => {
    mockJev({ a: { type: "noul", noul: 0.9 }, b: { type: "choice", choice: "small", confidence: 0.9, probabilities: { small: 0.9, large: 0.1 } } });
    await decide("hello", { a: yesNo, b: choice });

    assert.equal(lastRequest.url, "https://openrouter.ai/api/alpha/decisions");
    assert.equal(lastRequest.headers.Authorization, "Bearer test-key");
    assert.deepEqual(lastRequest.body.state, ["hello"]);
    assert.deepEqual(lastRequest.body.questions.a, { type: "noul", instructions: "Q?", criteria: { true: "yes case", false: "no case" } });
    assert.deepEqual(lastRequest.body.questions.b, { type: "choice", instructions: "Size?", criteria: { small: "s", large: "l" } });
  });

  it("passes object state unchanged", async () => {
    mockJev({ a: { type: "noul", noul: 0.9 } });
    await decide({ title: "t" }, { a: yesNo });
    assert.deepEqual(lastRequest.body.state, { title: "t" });
  });

  it("applies threshold and margin to yes/no answers", async () => {
    mockJev({
      clear_yes: { type: "noul", noul: 0.95 },
      clear_no: { type: "noul", noul: 0.05 },
      close: { type: "noul", noul: 0.65 },
    });
    const { decisions, cost_usd } = await decide("x", {
      clear_yes: yesNo,
      clear_no: yesNo,
      close: { ...yesNo, threshold: 0.7 },
    });

    assert.equal(decisions.clear_yes.decision, "yes");
    assert.equal(decisions.clear_yes.uncertain, false);
    assert.equal(decisions.clear_no.decision, "no");
    assert.equal(decisions.close.decision, "no");
    assert.equal(decisions.close.uncertain, true);
    assert.equal(cost_usd, 0.00001);
  });

  it("marks low-confidence choices as uncertain", async () => {
    mockJev({ b: { type: "choice", choice: "large", confidence: 0.4, probabilities: { small: 0.45, large: 0.55 } } });
    const { decisions } = await decide("x", { b: choice });
    assert.equal(decisions.b.decision, "large");
    assert.equal(decisions.b.uncertain, true);
  });

  it("rejects choice rules with fewer than 2 options", async () => {
    await assert.rejects(decide("x", { b: { ...choice, options: { only: "one" } } }), /at least 2 options/);
  });

  it("reports API errors with status and message", async () => {
    mockJev({}, 400);
    await assert.rejects(decide("x", { a: yesNo }), /Jev API error 400: Bad request/);
  });

  it("fails clearly when the API key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await assert.rejects(decide("x", { a: yesNo }), /OPENROUTER_API_KEY is not set/);
  });
});
