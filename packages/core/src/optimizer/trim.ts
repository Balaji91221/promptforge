// Rule-based trim — no AI, free, instant (plan §9.2).
// Used standalone AND as the Prompt Helper's pre-clean step (§9.1).
// Deterministic: strip filler, collapse whitespace, drop repetition.

const FILLER = [
  /\b(um+|uh+|erm+|like,? )\b/gi,
  /\b(basically|literally|actually|just kinda|kind of|sort of)\b/gi,
  /\b(please|pls|plz|kindly)\b/gi,
  /\b(i think that|i was wondering if you could|can you please|could you please)\b/gi,
];

export interface TrimResult {
  cleaned: string;
  removedChars: number;
}

export function ruleTrim(input: string): TrimResult {
  let s = input;
  for (const re of FILLER) s = s.replace(re, " ");
  // collapse repeated whitespace and blank lines
  s = s.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  // collapse immediate duplicate words ("the the")
  s = s.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
  s = s.trim();
  return { cleaned: s, removedChars: input.length - s.length };
}
