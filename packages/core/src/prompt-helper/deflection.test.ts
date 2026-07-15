import { describe, it, expect, vi } from "vitest";
import { refine, isDeflection } from "./index.js";

describe("isDeflection", () => {
  it.each([
    "I'd like to clarify my request, could you help me rephrase or provide more information about what you need from me?",
    "Could you please let me know what additional details you need?",
    "What information do you need from me to proceed?",
    "I think my request may not have been clear.",
  ])("flags deflection: %s", (s) => {
    expect(isDeflection(s)).toBe(true);
  });

  it.each([
    "Summarize the article below in 5 bullet points, preserving key facts.",
    "Improve my resume for a fintech backend role; I have 3 years of Java.",
    "I need help with my project. Ask me up to 3 targeted questions to identify what I'm stuck on, then give me concrete next steps.",
    "Explain HTTPS to a 12-year-old using one everyday analogy.",
  ])("passes directive prompts: %s", (s) => {
    expect(isDeflection(s)).toBe(false);
  });
});

describe("refine deflection safety net", () => {
  const deflected = JSON.stringify({
    intent: "other",
    refined_prompt:
      "I'd like to clarify my request, could you help me rephrase or provide more information about what you need from me?",
    applied_techniques: ["clarify intent"],
    suggestions: ["specify what you're unclear about"],
    quality_before: 0,
    quality_after: 80,
  });

  it("replaces a deflected rewrite with a directive fallback", async () => {
    const call = vi.fn().mockResolvedValue(deflected);
    const out = await refine("i need help. sduhosdho", call);
    expect(out.status).toBe("ok");
    const refined = out.result!.refined_prompt;
    expect(isDeflection(refined)).toBe(false);
    // fallback must be a directive that carries the user's fragment
    expect(refined).toContain("sduhosdho");
    expect(refined).toMatch(/ask me up to 3/i);
    // quality is capped so the UI doesn't overstate a rescue
    expect(out.result!.quality_after).toBeLessThanOrEqual(50);
    expect(out.result!.suggestions[0]).toMatch(/describe the actual task/i);
  });

  it("leaves good rewrites untouched", async () => {
    const good = JSON.stringify({
      intent: "summarize",
      refined_prompt: "Summarize the article below in 5 bullet points.",
      applied_techniques: ["clarity"],
      suggestions: [],
      quality_before: 20,
      quality_after: 85,
    });
    const call = vi.fn().mockResolvedValue(good);
    const out = await refine("summarize this long article for me please", call);
    expect(out.result!.refined_prompt).toBe("Summarize the article below in 5 bullet points.");
    expect(out.result!.quality_after).toBe(85);
  });
});
