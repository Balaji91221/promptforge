// Compression (plan §9.2) — the optional, small-model, LLMLingua-2-style step.
// Drops low-information tokens while preserving meaning. Long prompts only,
// when the savings beat the cost. Phase 2 (hosted). This module defines the
// deterministic budgeting/decision logic; the actual model call is injected.

import { estimateTokens } from "../metering/tokenizer.js";

/** Only worth compressing above this size (below it, the call costs more). */
export const MIN_TOKENS_TO_COMPRESS = 400;

export interface CompressDecision {
  shouldCompress: boolean;
  tokens: number;
  reason: string;
}

export function shouldCompress(text: string): CompressDecision {
  const tokens = estimateTokens(text);
  if (tokens < MIN_TOKENS_TO_COMPRESS) {
    return { shouldCompress: false, tokens, reason: "below compression threshold" };
  }
  return { shouldCompress: true, tokens, reason: "long enough to benefit" };
}

export interface CompressCall {
  (text: string, targetRatio: number): Promise<string>;
}

/** Compress to ~targetRatio of the original, but only when it's worthwhile. */
export async function compress(
  text: string,
  call: CompressCall,
  targetRatio = 0.6,
): Promise<string> {
  const d = shouldCompress(text);
  if (!d.shouldCompress) return text;
  const out = await call(text, targetRatio);
  // Guardrail: never return something longer than the input.
  return estimateTokens(out) < d.tokens ? out : text;
}
