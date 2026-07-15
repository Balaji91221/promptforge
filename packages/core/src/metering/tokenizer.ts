// Tokenizer / metering (plan §9.3) — plain algorithm, not AI.
// Phase 0 uses a fast heuristic estimate; Phase 1+ swaps in js-tiktoken /
// the Anthropic count endpoint / Google countTokens per the adapter (§13).

/**
 * Heuristic token estimate. Good enough for a live "as you type" counter.
 * Rule of thumb across GPT/Claude tokenizers: ~4 chars/token for English prose,
 * with a floor based on whitespace-delimited words so short strings aren't 0.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const byChars = chars / 4;
  const byWords = words * 1.3;
  return Math.max(1, Math.round((byChars + byWords) / 2));
}

export interface TokenDelta {
  before: number;
  after: number;
  saved: number; // positive = fewer tokens after
}

export function tokenDelta(before: string, after: string): TokenDelta {
  const b = estimateTokens(before);
  const a = estimateTokens(after);
  return { before: b, after: a, saved: b - a };
}
