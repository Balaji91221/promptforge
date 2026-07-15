import { describe, it, expect, vi } from "vitest";
import { refine, MIN_CHARS_FOR_REWRITE } from "./index.js";
import { preClassify, hintForIntent } from "./templates.js";

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
