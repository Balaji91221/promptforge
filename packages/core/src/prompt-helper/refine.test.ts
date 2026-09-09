import { describe, it, expect, vi } from "vitest";
import { refine, MIN_CHARS_FOR_REWRITE } from "./index.js";
import { preClassify, hintForIntent } from "./templates.js";
import { makeArray } from "../optimizer/fixtures.test-util.js";

const RESULT = JSON.stringify({
  intent: "summarize",
  refined_prompt: "Summarize the article below in 5 bullet points.",
  applied_techniques: ["clarity", "output format"],
  suggestions: ["specify desired length"],
  quality_before: 25,
  quality_after: 82,
});

describe("refine pipeline", () => {
  it("short-circuits trivial input without calling the model", async () => {
    const call = vi.fn();
    const out = await refine("hi", call);
    expect(out.status).toBe("too_short");
    expect(call).not.toHaveBeenCalled();
  });

  it("runs the full pipeline and attaches token deltas", async () => {
    const call = vi.fn().mockResolvedValue(RESULT);
    const out = await refine("summarize this long article for me please", call);
    expect(out.status).toBe("ok");
    expect(out.result?.intent).toBe("summarize");
    expect(out.result?.tokens_before).toBeGreaterThan(0);
    expect(out.result?.tokens_after).toBeGreaterThan(0);
    expect(call).toHaveBeenCalledOnce();
  });

  it("passes an intent hint to the model when pre-classified", async () => {
    const call = vi.fn().mockResolvedValue(RESULT);
    await refine("summarize this long article for me please", call);
    const userTurn = call.mock.calls[0]![1] as string;
    expect(userTurn).toContain("FOCUS HINT");
  });

  it("pre-cleans filler before sending", async () => {
    const call = vi.fn().mockResolvedValue(RESULT);
    await refine("um basically summarize this long article for me", call);
    const userTurn = call.mock.calls[0]![1] as string;
    expect(userTurn).not.toMatch(/\bum\b|\bbasically\b/i);
  });

  it("exposes a sane minimum-length gate", () => {
    expect(MIN_CHARS_FOR_REWRITE).toBeGreaterThan(0);
    expect(MIN_CHARS_FOR_REWRITE).toBeLessThan(50);
  });
});

describe("intent templates", () => {
  it.each([
    ["write me a python function", "code"],
    ["draft an email to my landlord", "email"],
    ["summarize this report", "summarize"],
    ["explain how https works", "explain"],
    ["compare these sources and cite them", "research"],
    ["book a table for two", "other"],
  ])("classifies %s → %s", (input, intent) => {
    expect(preClassify(input)).toBe(intent);
  });

  it("provides a hint for every known intent", () => {
    for (const intent of ["summarize", "code", "email", "explain", "research"] as const) {
      expect(hintForIntent(intent)).not.toBe("");
    }
    expect(hintForIntent("other")).toBe("");
  });
});

describe("paste mode (instruction + large JSON array)", () => {
  const ARR = makeArray(40, { note: "please just keep the the raw value" });
  const PASTE_RESULT = JSON.stringify({
    intent: "summarize",
    refined_prompt: "Summarize the data below in 5 bullet points for a manager.",
    applied_techniques: ["clarity", "output format"],
    suggestions: ["specify desired length"],
    quality_before: 25,
    quality_after: 82,
  });

  it("forges a 9-char instruction that the normal 12-char gate would reject", async () => {
    const call = vi.fn().mockResolvedValue(PASTE_RESULT);
    const out = await refine(`summarize\n\n${ARR}`, call);
    expect(out.status).toBe("ok");
    expect(call).toHaveBeenCalledOnce();
  });

  it("sends the model the instruction and an attachment note, never the payload", async () => {
    const call = vi.fn().mockResolvedValue(PASTE_RESULT);
    await refine(`summarize\n\n${ARR}`, call);
    const userTurn = call.mock.calls[0]?.[1] as string;
    expect(userTurn).toContain("ATTACHED DATA");
    expect(userTurn).toContain("40 items");
    expect(userTurn).not.toContain("doc-000007");
  });

  it("appends the payload verbatim after the refined instruction when no compressor is set", async () => {
    const call = vi.fn().mockResolvedValue(PASTE_RESULT);
    const out = await refine(`summarize\n\n${ARR}`, call);
    expect(out.result?.refined_prompt).toBe(`Summarize the data below in 5 bullet points for a manager.\n\n${ARR}`);
    expect(out.result?.compression).toBeUndefined();
  });

  it("never runs filler trimming on the payload (\"please\", \"just\", \"the the\" survive)", async () => {
    const call = vi.fn().mockResolvedValue(PASTE_RESULT);
    const out = await refine(`please summarize\n\n${ARR}`, call);
    expect(out.result?.refined_prompt).toContain("please just keep the the raw value");
  });

  it("classifies intent from the instruction, not from words inside the data", async () => {
    const call = vi.fn().mockResolvedValue(PASTE_RESULT);
    const data = makeArray(40, { body: "write a python function with this code" });
    await refine(`summarize these for me\n\n${data}`, call);
    const userTurn = call.mock.calls[0]?.[1] as string;
    expect(userTurn).toContain("source to summarize");
    expect(userTurn).not.toContain("Focus: language");
  });

  it("uses the compressed payload and reports compression when the compressor succeeds", async () => {
    const call = vi.fn().mockResolvedValue(PASTE_RESULT);
    const compress = vi.fn().mockResolvedValue({
      kind: "compressed", provider: "headroom", text: "[40]{id:string,title:string}\ndoc-000000,Report 0\n",
      tokensBefore: 1320, tokensAfter: 610, transforms: ["router:mixed:0.42"],
    });
    const out = await refine(`summarize\n\n${ARR}`, call, { compress });
    expect(out.result?.refined_prompt.endsWith("[40]{id:string,title:string}\ndoc-000000,Report 0\n")).toBe(true);
    expect(out.result?.compression).toEqual({
      provider: "headroom", tokens_before: 1320, tokens_after: 610, transforms: ["router:mixed:0.42"],
    });
    expect(out.result?.tokens_after ?? Infinity).toBeLessThan(out.result?.tokens_before ?? 0);
  });

  it("falls back to the original payload when the compressor fails", async () => {
    const call = vi.fn().mockResolvedValue(PASTE_RESULT);
    const compress = vi.fn().mockResolvedValue({ kind: "failed", error: "timed out after 1500ms" });
    const out = await refine(`summarize\n\n${ARR}`, call, { compress });
    expect(out.result?.refined_prompt.endsWith(ARR)).toBe(true);
    expect(out.result?.compression).toBeUndefined();
  });

  it("treats a bare data paste as too short and makes no model call", async () => {
    const call = vi.fn();
    const out = await refine(ARR, call);
    expect(out.status).toBe("too_short");
    expect(call).not.toHaveBeenCalled();
  });
});
