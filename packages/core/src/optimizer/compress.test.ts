import { describe, it, expect, vi } from "vitest";
import { detectPaste, compressPayload, assemblePrompt, MIN_TOKENS_TO_COMPRESS, type PasteContext } from "./compress.js";
import { makeArray } from "./fixtures.test-util.js";

const BIG = makeArray(40);

describe("detectPaste", () => {
  it("returns null for plain input", () => {
    expect(detectPaste("summarize this article for me")).toBeNull();
  });
  it("returns null for a JSON array under the token threshold", () => {
    expect(detectPaste(`summarize\n\n${makeArray(3)}`)).toBeNull();
  });
  it("returns a context for a qualifying paste", () => {
    const ctx = detectPaste(`summarize\n\n${BIG}`);
    expect(ctx).not.toBeNull();
    expect(ctx?.instruction).toBe("summarize");
    expect(ctx?.payload).toBe(BIG);
    expect(ctx?.itemCount).toBe(40);
    expect(ctx?.payloadTokens).toBeGreaterThanOrEqual(MIN_TOKENS_TO_COMPRESS);
  });
});

describe("compressPayload", () => {
  const ctx: PasteContext = { instruction: "summarize", payload: BIG, itemCount: 40, payloadTokens: 1300 };

  it("returns the original payload when no compressor is configured", async () => {
    expect(await compressPayload(ctx)).toEqual({ payload: BIG });
  });
  it("returns the original payload when the compressor skips or fails", async () => {
    const skipped = vi.fn().mockResolvedValue({ kind: "skipped", reason: "saved 10% < 25%" });
    const failed = vi.fn().mockResolvedValue({ kind: "failed", error: "fetch failed" });
    expect(await compressPayload(ctx, skipped)).toEqual({ payload: BIG });
    expect(await compressPayload(ctx, failed)).toEqual({ payload: BIG });
  });
  it("returns the original payload when the compressor throws", async () => {
    const throwing = vi.fn().mockRejectedValue(new Error("bug"));
    expect(await compressPayload(ctx, throwing)).toEqual({ payload: BIG });
  });
  it("passes payload and instruction to the compressor and returns text + info", async () => {
    const compressor = vi.fn().mockResolvedValue({
      kind: "compressed", provider: "headroom", text: "[40]{id:string}\ndoc-000000\n", tokensBefore: 1300, tokensAfter: 600, transforms: ["router:mixed:0.4"],
    });
    const out = await compressPayload(ctx, compressor);
    expect(compressor).toHaveBeenCalledWith(BIG, "summarize");
    expect(out.payload).toBe("[40]{id:string}\ndoc-000000\n");
    expect(out.info).toEqual({ provider: "headroom", tokens_before: 1300, tokens_after: 600, transforms: ["router:mixed:0.4"] });
  });
});

describe("assemblePrompt", () => {
  it("puts the trimmed instruction first and the payload after one blank line", () => {
    expect(assemblePrompt("  Summarize the data below.  ", "[1,2]")).toBe("Summarize the data below.\n\n[1,2]");
  });
});
