// Structured-output parser (plan §9.1). Model returns JSON → validated result.
// Tolerant of markdown fences / stray preamble since cheap models drift.

import type { PromptHelperResult, Intent } from "@promptforge/types";

const INTENTS: Intent[] = ["summarize", "code", "email", "explain", "research", "other"];

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/** Extract the first balanced JSON object from a possibly-noisy string. */
export function extractJson(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

export class ParseError extends Error {}

export function parseResult(raw: string): PromptHelperResult {
  const json = extractJson(raw);
  if (!json) throw new ParseError("no JSON object found in model output");

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch (e) {
    throw new ParseError(`invalid JSON: ${(e as Error).message}`);
  }

  const refined = typeof obj.refined_prompt === "string" ? obj.refined_prompt.trim() : "";
  if (!refined) throw new ParseError("missing refined_prompt");

  const intent = INTENTS.includes(obj.intent as Intent) ? (obj.intent as Intent) : "other";

  return {
    intent,
    refined_prompt: refined,
    applied_techniques: toStringArray(obj.applied_techniques),
    suggestions: toStringArray(obj.suggestions),
    quality_before: clampScore(obj.quality_before),
    quality_after: clampScore(obj.quality_after),
  };
}
