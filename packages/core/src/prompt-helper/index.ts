// Prompt Helper orchestration (plan §9.1) — the centerpiece.
// Flow: pre-clean (free) → gate on length → one cheap-LLM call → parse →
// attach token delta. The actual network call is injected so core stays
// isomorphic (browser shell, backend, and eval runner supply their own).

import type { PromptHelperResult } from "@promptforge/types";
import { ruleTrim } from "../optimizer/trim.js";
import { tokenDelta } from "../metering/tokenizer.js";
import { META_PROMPT, buildUserTurn } from "./meta-prompt.js";
import { parseResult } from "./parser.js";
import { preClassify, hintForIntent } from "./templates.js";

/** Minimum input length worth spending an AI call on (guardrail, §9.1). */
export const MIN_CHARS_FOR_REWRITE = 12;

export interface LlmCall {
  /** Given system + user content, return the raw model text (JSON expected). */
  (system: string, user: string): Promise<string>;
}

export type RefineStatus = "too_short" | "ok";

export interface RefineOutput {
  status: RefineStatus;
  cleaned: string;
  result?: PromptHelperResult;
}

/**
 * Run the full rewrite pipeline. Returns `too_short` without an AI call when
 * the (pre-cleaned) input is trivial — never spend a call on a trivial ask.
 */
export async function refine(rawInput: string, call: LlmCall): Promise<RefineOutput> {
  const { cleaned } = ruleTrim(rawInput);

  if (cleaned.length < MIN_CHARS_FOR_REWRITE) {
    return { status: "too_short", cleaned };
  }

  // Cheap pre-classification supplies an intent-specific focus hint (§9.1).
  const hint = hintForIntent(preClassify(cleaned));
  const rawOut = await call(META_PROMPT, buildUserTurn(cleaned, hint));
  const result = parseResult(rawOut);

  const delta = tokenDelta(rawInput, result.refined_prompt);
  result.tokens_before = delta.before;
  result.tokens_after = delta.after;

  return { status: "ok", cleaned, result };
}
