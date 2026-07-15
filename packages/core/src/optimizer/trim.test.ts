import { describe, it, expect } from "vitest";
import { ruleTrim } from "./trim.js";

describe("ruleTrim", () => {
  it("strips filler words", () => {
    const { cleaned } = ruleTrim("um basically can you please summarize this");
    expect(cleaned).not.toMatch(/\bum\b|\bbasically\b|\bplease\b/i);
    expect(cleaned).toContain("summarize this");
  });

  it("collapses repeated whitespace and blank lines", () => {
    const { cleaned } = ruleTrim("hello   world\n\n\n\nbye");
    expect(cleaned).toBe("hello world\n\nbye");
  });

  it("collapses immediate duplicate words", () => {
    const { cleaned } = ruleTrim("the the quick brown fox");
    expect(cleaned).toBe("the quick brown fox");
  });

  it("reports removed character count", () => {
    const input = "um  hello";
    const { cleaned, removedChars } = ruleTrim(input);
    expect(removedChars).toBe(input.length - cleaned.length);
    expect(removedChars).toBeGreaterThan(0);
  });

  it("leaves clean text untouched", () => {
    const input = "Summarize the attached report in 5 bullets.";
    expect(ruleTrim(input).cleaned).toBe(input);
  });
});
