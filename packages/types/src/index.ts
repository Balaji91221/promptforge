// Shared types & schema for PromptForge — mirrors Appendix B of the plan.

export type Intent =
  | "summarize"
  | "code"
  | "email"
  | "explain"
  | "research"
  | "other";

/** Structured result the model returns (Appendix A meta-prompt → Appendix B schema). */
export interface PromptHelperResult {
  intent: Intent;
  refined_prompt: string;
  /** shown as "what changed" */
  applied_techniques: string[];
  /** shown as coaching tips (Coach mode) */
  suggestions: string[];
  /** 0–100 — labeled "estimated" in UI */
  quality_before: number;
  /** 0–100 — labeled "estimated" in UI */
  quality_after: number;
  /** from the metering subsystem */
  tokens_before?: number;
  tokens_after?: number;
  /** present only when an attached payload was compressed locally before the rewrite */
  compression?: CompressionInfo;
}

/** Local compression applied to an attached payload (e.g. a pasted JSON array). */
export type CompressionInfo = {
  provider: "builtin" | "headroom";
  /** counted by the compressor; includes ~20 tokens of its own message scaffolding */
  tokens_before: number;
  tokens_after: number;
  /** compressor-reported transform ids, e.g. "router:mixed:0.41" */
  transforms: string[];
};

/** Ground-truth signal recorded per rewrite (drives gates §7 + dashboard). */
export type Outcome = "accepted" | "edited_then_sent" | "dismissed";

/** Local-only event stored in Phase 0 (no accounts, no sync). */
export interface PromptEvent {
  id: string;
  ts: number;
  platform: string; // e.g. "claude"
  raw_input: string;
  result: PromptHelperResult;
  outcome: Outcome | null; // null until the user acts
}

/** Request/response contract with the backend rewrite function. */
export interface RewriteRequest {
  input: string;
  platform: string;
  /** optional BYO key path for Phase 0 testers */
  byoKey?: string;
}
