// Intent / template selector (plan §9.1). Classifies the ask and supplies a
// matching template hint that sharpens the rewrite + suggestions. Versioned
// with the meta-prompt; served from Remote Config in Phase 2.
import type { Intent } from "@promptforge/types";

interface Template {
  intent: Intent;
  /** appended to the meta-prompt as a focus hint for this intent */
  hint: string;
  /** cheap keyword signals for pre-classification before the model call */
  signals: RegExp;
}

export const TEMPLATES: Template[] = [
  { intent: "summarize", signals: /\b(summari[sz]e|tl;?dr|shorten|key points)\b/i,
    hint: "Focus: source to summarize, desired length, and output format (bullets/paragraph)." },
  { intent: "code", signals: /\b(code|function|bug|script|python|javascript|typescript|sql|regex)\b/i,
    hint: "Focus: language, inputs/outputs, constraints, and an example case." },
  { intent: "email", signals: /\b(email|e-?mail|message to|reply to|draft a note)\b/i,
    hint: "Focus: recipient, goal, tone, and key points to include." },
  { intent: "explain", signals: /\b(explain|how does|what is|eli5|teach me)\b/i,
    hint: "Focus: audience/level, depth, and whether an analogy or example helps." },
  { intent: "research", signals: /\b(research|compare|analy[sz]e|sources|cite|literature)\b/i,
    hint: "Focus: scope, required sources/citations, structure, and success criteria." },
];

/** Cheap pre-classification (no AI). The model still returns the final intent. */
export function preClassify(input: string): Intent {
  for (const t of TEMPLATES) if (t.signals.test(input)) return t.intent;
  return "other";
}

export function hintForIntent(intent: Intent): string {
  return TEMPLATES.find((t) => t.intent === intent)?.hint ?? "";
}
