// Headroom client — local context compression (github.com/headroomlabs-ai/headroom).
// Talks to the user's own proxy on loopback: POST /v1/compress, GET /health.
// Nothing here is browser-specific; the extension's background worker and the
// eval harness both use it. Evidence for every choice below is in
// docs/spikes/2026-09-09-headroom-compress.md.

import type { PayloadCompressor, CompressOutcome } from "./compress.js";

export type HeadroomConfig = {
  /** Loopback only; see isLoopbackUrl(). */
  baseUrl: string;
  /** Worst-case added wait: the rewrite call runs in parallel with compression. */
  timeoutMs: number;
};

export const HEADROOM_DEFAULTS: HeadroomConfig = { baseUrl: "http://127.0.0.1:8787", timeoutMs: 1500 };

/** Tokenizer hint sent to the proxy. Kept constant on purpose: the spike only
 *  validated this id, and the user's provider model id (e.g. an NVIDIA NIM
 *  path) may be unknown to the proxy. It affects token counting only. */
export const HEADROOM_TOKENIZER_MODEL = "gpt-4o";

/** Reject a result that saves less than this share of tokens. */
export const MIN_SAVED_RATIO = 0.25;

const TOOL_CALL_ID = "pf_attachment";
const HEALTH_TIMEOUT_MS = 800;

export function isLoopbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
    return (u.protocol === "http:" || u.protocol === "https:") && loopback;
  } catch {
    return false;
  }
}

export type HeadroomHealth =
  | { ok: true; ms: number; version: string }
  | { ok: false; ms: number; error: string };

function errorMessage(e: unknown, timeoutMs: number): string {
  if (e instanceof Error) {
    return e.name === "TimeoutError" ? `timed out after ${timeoutMs}ms` : e.message;
  }
  return String(e);
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(ms) : undefined;
}

/** GET /health. Never throws. */
export async function headroomHealth(cfg: HeadroomConfig = HEADROOM_DEFAULTS): Promise<HeadroomHealth> {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/health`, { signal: timeoutSignal(HEALTH_TIMEOUT_MS) });
    if (!res.ok) return { ok: false, ms: ms(), error: `http ${res.status}` };
    const body: unknown = await res.json();
    const version = isRecord(body) && typeof body.version === "string" ? body.version : "unknown";
    const status = isRecord(body) && typeof body.status === "string" ? body.status : "unknown";
    if (status !== "healthy") return { ok: false, ms: ms(), error: `status ${status}` };
    return { ok: true, ms: ms(), version };
  } catch (e: unknown) {
    return { ok: false, ms: ms(), error: errorMessage(e, HEALTH_TIMEOUT_MS) };
  }
}

export type CompressStats = { tokensBefore: number; tokensAfter: number; transforms: string[] };
export type AcceptDecision = { accept: true } | { accept: false; reason: string };

/** The allowlist. `router:text` (the ML prose model) dropped facts in 5/5 spike
 *  runs and `noop` means nothing happened; both are rejected outright. */
export function acceptCompression(
  stats: CompressStats,
  output: string,
  minSaved: number = MIN_SAVED_RATIO,
): AcceptDecision {
  if (output.trim().length === 0) return { accept: false, reason: "empty output" };
  if (stats.transforms.length === 0) return { accept: false, reason: "no transform reported" };
  const lossy = stats.transforms.find((t) => /noop|text/i.test(t));
  if (lossy) return { accept: false, reason: `lossy or no-op transform: ${lossy}` };
  if (stats.tokensAfter >= stats.tokensBefore) return { accept: false, reason: "no saving" };
  const saved = 1 - stats.tokensAfter / stats.tokensBefore;
  if (saved < minSaved) {
    return { accept: false, reason: `saved ${Math.round(saved * 100)}% < ${Math.round(minSaved * 100)}%` };
  }
  return { accept: true };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

type Parsed = { toolText: string } & CompressStats;

/** Narrow the proxy response. Picks the tool message by role + tool_call_id,
 *  never by index; any shape mismatch → null (→ "failed"). */
export function parseCompressResponse(body: unknown): Parsed | null {
  if (!isRecord(body) || !Array.isArray(body.messages)) return null;
  const tool = body.messages.find(
    (m): m is Record<string, unknown> => isRecord(m) && m.role === "tool" && m.tool_call_id === TOOL_CALL_ID,
  );
  if (!tool || typeof tool.content !== "string") return null;
  const { tokens_before, tokens_after, transforms_applied } = body;
  if (typeof tokens_before !== "number" || !Number.isFinite(tokens_before)) return null;
  if (typeof tokens_after !== "number" || !Number.isFinite(tokens_after)) return null;
  if (!Array.isArray(transforms_applied) || !transforms_applied.every((t) => typeof t === "string")) return null;
  return { toolText: tool.content, tokensBefore: tokens_before, tokensAfter: tokens_after, transforms: transforms_applied };
}

/** Request body: the payload travels as a tool result. That shape comes back as
 *  plain text with real newlines; the user-message shape comes back as a quoted,
 *  \n-escaped JSON string (spike P3 vs P5). The instruction is sent only as
 *  relevance context and is never read back. */
export function buildCompressRequest(payload: string, instruction: string): Record<string, unknown> {
  return {
    model: HEADROOM_TOKENIZER_MODEL,
    messages: [
      { role: "user", content: instruction || "Process the attached data." },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: TOOL_CALL_ID, type: "function", function: { name: "read_attachment", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: TOOL_CALL_ID, content: payload },
    ],
  };
}

/** Build a PayloadCompressor bound to a proxy. The returned function never rejects. */
export function buildHeadroomCompress(cfg: HeadroomConfig = HEADROOM_DEFAULTS): PayloadCompressor {
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/v1/compress`;
  return async (payload, instruction): Promise<CompressOutcome> => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildCompressRequest(payload, instruction)),
        signal: timeoutSignal(cfg.timeoutMs),
      });
      if (!res.ok) return { kind: "failed", error: `headroom ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const parsed = parseCompressResponse(await res.json());
      if (!parsed) return { kind: "failed", error: "unexpected response shape from /v1/compress" };
      const stats = { tokensBefore: parsed.tokensBefore, tokensAfter: parsed.tokensAfter, transforms: parsed.transforms };
      const decision = acceptCompression(stats, parsed.toolText);
      if (!decision.accept) return { kind: "skipped", reason: decision.reason };
      return { kind: "compressed", provider: "headroom", text: parsed.toolText, ...stats };
    } catch (e: unknown) {
      return { kind: "failed", error: errorMessage(e, cfg.timeoutMs) };
    }
  };
}
