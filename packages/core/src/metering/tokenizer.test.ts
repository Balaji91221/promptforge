import { describe, it, expect } from "vitest";
import { estimateTokens, tokenDelta } from "./tokenizer.js";

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns at least 1 for any non-empty text", () => {
    expect(estimateTokens("a")).toBeGreaterThanOrEqual(1);
  });

  it("scales with text length", () => {
    const short = estimateTokens("hello world");
    const long = estimateTokens("hello world ".repeat(50));
    expect(long).toBeGreaterThan(short * 10);
  });
});

describe("tokenDelta", () => {
  it("reports positive savings when text shrinks", () => {
    const d = tokenDelta("one two three four five six seven eight", "one two");
    expect(d.saved).toBeGreaterThan(0);
    expect(d.before).toBeGreaterThan(d.after);
  });

  it("reports negative savings when text grows", () => {
    const d = tokenDelta("hi there", "a much longer refined prompt with structure and criteria");
    expect(d.saved).toBeLessThan(0);
  });
});
