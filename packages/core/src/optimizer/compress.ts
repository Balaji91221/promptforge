// Compression (plan §9.2) — attached-payload compression. This module holds the
// deterministic parts: when a paste qualifies, how to run an injected compressor
// without ever failing the rewrite, and how to reassemble the final prompt.
// The compressor itself (optimizer/headroom.ts) is injected so core stays
// isomorphic and every path is testable without a proxy.

import type { CompressionInfo } from "@promptforge/types";
import { estimateTokens } from "../metering/tokenizer.js";
import { splitPaste } from "./paste.js";

/** Only worth compressing above this size (below it, the call costs more than it saves). */
export const MIN_TOKENS_TO_COMPRESS = 400;

export type CompressDecision = { shouldCompress: boolean; tokens: number; reason: string };

export function shouldCompress(text: string): CompressDecision {
  const tokens = estimateTokens(text);
  if (tokens < MIN_TOKENS_TO_COMPRESS) {
    return { shouldCompress: false, tokens, reason: "below compression threshold" };
  }
  return { shouldCompress: true, tokens, reason: "long enough to benefit" };
}

/** An input that is instruction + a large JSON-array payload. */
export type PasteContext = {
  instruction: string;
  payload: string;
  itemCount: number;
  payloadTokens: number;
};

/** Detect a qualifying paste: JSON array ≥ 2 items AND ≥ MIN_TOKENS_TO_COMPRESS tokens. */
export function detectPaste(raw: string): PasteContext | null {
  const s = splitPaste(raw);
  if (s.kind !== "paste") return null;
  const payloadTokens = estimateTokens(s.payload);
  if (payloadTokens < MIN_TOKENS_TO_COMPRESS) return null;
  return { instruction: s.instruction, payload: s.payload, itemCount: s.itemCount, payloadTokens };
}

export type CompressOutcome =
  | {
      kind: "compressed";
      provider: CompressionInfo["provider"];
      text: string;
      tokensBefore: number;
      tokensAfter: number;
      transforms: string[];
    }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; error: string };

/** A compressor receives the payload plus the user's instruction (for relevance)
 *  and must resolve, never reject. */
export type PayloadCompressor = (payload: string, instruction: string) => Promise<CompressOutcome>;

export type CompressedPayload = { payload: string; info?: CompressionInfo };

/** Run the compressor if one is configured. Any failure or rejection → original payload. */
export async function compressPayload(
  ctx: PasteContext,
  compressor?: PayloadCompressor,
): Promise<CompressedPayload> {
  if (!compressor) return { payload: ctx.payload };
  let out: CompressOutcome;
  try {
    out = await compressor(ctx.payload, ctx.instruction);
  } catch (e: unknown) {
    out = { kind: "failed", error: e instanceof Error ? e.message : String(e) };
  }
  if (out.kind !== "compressed") return { payload: ctx.payload };
  return {
    payload: out.text,
    info: {
      provider: out.provider,
      tokens_before: out.tokensBefore,
      tokens_after: out.tokensAfter,
      transforms: out.transforms,
    },
  };
}

/** Final prompt: refined instruction first (readable at the top of the composer),
 *  then the data, separated by one blank line. */
export function assemblePrompt(refinedInstruction: string, payload: string): string {
  return `${refinedInstruction.trim()}\n\n${payload}`;
}
