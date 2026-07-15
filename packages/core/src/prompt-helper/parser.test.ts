import { describe, it, expect } from "vitest";
import { parseResult, extractJson, ParseError } from "./parser.js";

const VALID = {
  intent: "code",
  refined_prompt: "Write a Python function to reverse a string.",
  applied_techniques: ["clarity"],
  suggestions: ["add an example"],
  quality_before: 30,
  quality_after: 80,
};

describe("extractJson", () => {
  it("extracts a bare JSON object", () => {
    expect(extractJson(JSON.stringify(VALID))).toBe(JSON.stringify(VALID));
  });

  it("extracts JSON wrapped in markdown fences and preamble", () => {
    const noisy = "Sure! ```json\n" + JSON.stringify(VALID) + "\n```";
    expect(JSON.parse(extractJson(noisy)!)).toEqual(VALID);
  });

  it("handles braces inside string values", () => {
    const tricky = { ...VALID, refined_prompt: 'Use {"nested": true} in the payload.' };
    expect(JSON.parse(extractJson(JSON.stringify(tricky))!)).toEqual(tricky);
  });

  it("handles escaped quotes inside strings", () => {
    const tricky = { ...VALID, refined_prompt: 'Say \\"hello\\" politely.' };
    const raw = JSON.stringify(tricky);
    expect(extractJson(raw)).toBe(raw);
  });

  it("returns null when no JSON object exists", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("parseResult", () => {
  it("parses a valid result", () => {
    const r = parseResult(JSON.stringify(VALID));
    expect(r.intent).toBe("code");
    expect(r.refined_prompt).toBe(VALID.refined_prompt);
    expect(r.applied_techniques).toEqual(["clarity"]);
  });

  it("defaults unknown intent to 'other'", () => {
    const r = parseResult(JSON.stringify({ ...VALID, intent: "poetry" }));
    expect(r.intent).toBe("other");
  });

  it("clamps quality scores to 0..100", () => {
    const r = parseResult(JSON.stringify({ ...VALID, quality_before: -5, quality_after: 250 }));
    expect(r.quality_before).toBe(0);
    expect(r.quality_after).toBe(100);
  });

  it("filters non-string entries out of arrays", () => {
    const r = parseResult(JSON.stringify({ ...VALID, suggestions: ["ok", 42, null, ""] }));
    expect(r.suggestions).toEqual(["ok"]);
  });

  it("throws ParseError on missing refined_prompt", () => {
    const { refined_prompt: _drop, ...rest } = VALID;
    expect(() => parseResult(JSON.stringify(rest))).toThrow(ParseError);
  });

  it("throws ParseError on non-JSON output", () => {
    expect(() => parseResult("I cannot help with that.")).toThrow(ParseError);
  });
});
