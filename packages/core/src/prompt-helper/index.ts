// Prompt Helper orchestration (plan §9.1) — the centerpiece.
// Flow: pre-clean (free) → gate on length → one cheap-LLM call → parse →
// attach token delta. The actual network call is injected so core stays
// isomorphic (browser shell, backend, and eval runner supply their own).
//
// Paste mode (§9.2): when the input is an instruction plus a large JSON-array
// payload, only the instruction goes to the model; the payload is compressed
// locally (if a compressor is injected) and appended by code. The model could
// never echo a 5K-token paste back within its output budget anyway.

import type { PromptHelperResult } from "@promptforge/types";
import { ruleTrim } from "../optimizer/trim.js";
import { tokenDelta } from "../metering/tokenizer.js";
import {
  detectPaste,
  compressPayload,
  assemblePrompt,
  type PasteContext,
  type PayloadCompressor,
} from "../optimizer/compress.js";
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

export type RefineOptions = {
  /** Local payload compressor for paste mode (e.g. buildHeadroomCompress()). */
  compress?: PayloadCompressor;
};

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

/** Safety net: if the model deflected instead of forging, substitute a
 *  deterministic directive prompt and flag it for the coach panel. */
function guardDeflection(result: PromptHelperResult, cleaned: string): void {
  if (!isDeflection(result.refined_prompt)) return;
  result.refined_prompt = directiveFallback(cleaned);
  result.applied_techniques = ["converted vague input into a directive prompt"];
  result.suggestions = [
    "describe the actual task or topic you need help with",
    "add any constraints (format, length, audience)",
    ...result.suggestions,
  ];
  result.quality_after = Math.min(result.quality_after, 50);
}

/**
 * Run the full rewrite pipeline. Returns `too_short` without an AI call when
 * the (pre-cleaned) input is trivial — never spend a call on a trivial ask.
 */
export async function refine(
  rawInput: string,
  call: LlmCall,
  opts: RefineOptions = {},
): Promise<RefineOutput> {
  const paste = detectPaste(rawInput);
  if (paste) return refinePaste(rawInput, paste, call, opts.compress);

  const { cleaned } = ruleTrim(rawInput);
  if (cleaned.length < MIN_CHARS_FOR_REWRITE) {
    return { status: "too_short", cleaned };
  }

  // Cheap pre-classification supplies an intent-specific focus hint (§9.1).
  const hint = hintForIntent(preClassify(cleaned));
  const rawOut = await call(META_PROMPT, buildUserTurn(cleaned, hint));
  const result = parseResult(rawOut);
  guardDeflection(result, cleaned);

  const delta = tokenDelta(rawInput, result.refined_prompt);
  result.tokens_before = delta.before;
  result.tokens_after = delta.after;

  return { status: "ok", cleaned, result };
}

/** Paste mode. Trim and classify the INSTRUCTION only; the payload is never
 *  edited, never sent to the rewrite model, and never dropped. The model call
 *  and the compressor run in parallel; compression is best-effort. */
async function refinePaste(
  rawInput: string,
  paste: PasteContext,
  call: LlmCall,
  compressor?: PayloadCompressor,
): Promise<RefineOutput> {
  const { cleaned } = ruleTrim(paste.instruction);
  // A bare data paste has nothing to forge. The 12-char gate does not apply:
  // "summarize" (9 chars) is the flagship instruction here.
  if (cleaned.length === 0) return { status: "too_short", cleaned };

  const hint = hintForIntent(preClassify(cleaned));
  const note = { itemCount: paste.itemCount, tokens: paste.payloadTokens };
  const [rawOut, compressed] = await Promise.all([
    call(META_PROMPT, buildUserTurn(cleaned, hint, note)),
    compressPayload(paste, compressor), // resolves always, even on proxy failure
  ]);

  const result = parseResult(rawOut);
  guardDeflection(result, cleaned);
  result.refined_prompt = assemblePrompt(result.refined_prompt, compressed.payload);
  if (compressed.info) result.compression = compressed.info;

  const delta = tokenDelta(rawInput, result.refined_prompt);
  result.tokens_before = delta.before;
  result.tokens_after = delta.after;

  return { status: "ok", cleaned, result };
}
