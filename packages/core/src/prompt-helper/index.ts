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

// Deflection detector — the failure mode where the model, instead of forging a
// prompt, produces a message ABOUT the prompt ("could you help me rephrase?",
// "what do you need from me?"). Sending that to an AI yields a useless
// meta-conversation, which breaks the product's core promise.
const DEFLECTION_PATTERNS: RegExp[] = [
  /\bhelp me (rephrase|clarify|reword)\b/i,
  /\bclarify my (request|question|prompt)\b/i,
  /\bwhat (do )?you need from me\b/i,
  /\bwhat (additional )?(information|details) (do )?you need\b/i,
  /\bcould you (please )?(let me know|tell me) what\b/i,
  /\bis there anything (else )?you need\b/i,
  /\bmy (request|question|prompt) (may not have been|was not|wasn't) clear\b/i,
];

export function isDeflection(refined: string): boolean {
  return DEFLECTION_PATTERNS.some((re) => re.test(refined));
}

/** Deterministic fallback: turn vague input into a directive prompt instead of
 *  a plea. Guarantees the core contract even when the model misbehaves. */
function directiveFallback(cleaned: string): string {
  return (
    `I need help with the following: "${cleaned}". ` +
    `Ask me up to 3 targeted questions to pin down exactly what I need, ` +
    `then give me a concrete answer or next steps.`
  );
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

  // Safety net: if the model deflected instead of forging, substitute a
  // deterministic directive prompt and flag it for the coach panel.
  if (isDeflection(result.refined_prompt)) {
    result.refined_prompt = directiveFallback(cleaned);
    result.applied_techniques = ["converted vague input into a directive prompt"];
    result.suggestions = [
      "describe the actual task or topic you need help with",
      "add any constraints (format, length, audience)",
      ...result.suggestions,
    ];
    result.quality_after = Math.min(result.quality_after, 50);
  }

  const delta = tokenDelta(rawInput, result.refined_prompt);
  result.tokens_before = delta.before;
  result.tokens_after = delta.after;

  return { status: "ok", cleaned, result };
}
