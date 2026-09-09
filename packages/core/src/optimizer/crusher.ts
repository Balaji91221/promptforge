// Built-in compressor — Headroom's proven concepts, natively in TypeScript.
// Router → encoder → token accounting → the same allowlist the external engine
// uses. Zero install, zero network. Only the JSON-array route exists today: it
// produced 50% lossless savings in the spike. The lossless log/diff folds stayed
// under the 25% acceptance threshold and the ML prose route dropped facts, so
// neither is implemented (docs/spikes/2026-09-09-headroom-compress.md).
//
// Encoding: `[N]{key:type,…}` header, then one RFC-4180 CSV row per item.
// Nested objects flatten to dot keys (depth ≤ 3); arrays and deeper objects
// become JSON cells. Repeated keys, braces, quotes and indentation are what
// the model no longer has to read.

import { estimateTokens } from "../metering/tokenizer.js";
import { acceptCompression } from "./headroom.js";
import type { PayloadCompressor, CompressOutcome } from "./compress.js";

export type ContentType = "json-array" | "unknown";

const MAX_DEPTH = 3;
const MIN_ITEMS = 2;

type CellType = "string" | "int" | "float" | "bool" | "null" | "json";
type Cell = { text: string; type: CellType };
type Row = Map<string, Cell>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The array of objects behind `payload`, or null when it is not one. */
export function parseJsonArray(payload: string): Record<string, unknown>[] | null {
  const t = payload.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return null;
  try {
    const v: unknown = JSON.parse(t);
    if (!Array.isArray(v) || v.length < MIN_ITEMS) return null;
    return v.every(isPlainObject) ? v : null;
  } catch {
    return null;
  }
}

/** Content router. One case per encoder; add "logs" or "diff" here later. */
export function routeContent(payload: string): ContentType {
  return parseJsonArray(payload) ? "json-array" : "unknown";
}

function toCell(v: unknown): Cell {
  if (v === null) return { text: "null", type: "null" };
  if (typeof v === "string") return { text: v, type: "string" };
  if (typeof v === "number") return { text: String(v), type: Number.isInteger(v) ? "int" : "float" };
  if (typeof v === "boolean") return { text: v ? "true" : "false", type: "bool" };
  return { text: JSON.stringify(v), type: "json" };
}

function flatten(obj: Record<string, unknown>, prefix: string, depth: number, out: Row): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) && depth < MAX_DEPTH && Object.keys(v).length > 0) {
      flatten(v, key, depth + 1, out);
    } else {
      out.set(key, toCell(v));
    }
  }
}

/** RFC 4180: quote when the cell holds a comma, quote, or line break. */
export function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function columnType(rows: Row[], key: string): string {
  const seen = new Set<CellType>();
  for (const r of rows) {
    const c = r.get(key);
    if (c && c.type !== "null") seen.add(c.type);
  }
  if (seen.size === 0) return "null";
  const only = [...seen][0];
  return seen.size === 1 && only ? only : "any";
}

/** Schema header + CSV rows. Keys in first-seen order; a missing key is an
 *  empty cell. Type-faithful per column when the column is homogeneous. */
export function crushJsonArray(items: Record<string, unknown>[]): string {
  const rows: Row[] = items.map((it) => {
    const row: Row = new Map();
    flatten(it, "", 0, row);
    return row;
  });
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of r.keys()) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  const header = `[${items.length}]{${keys.map((k) => `${k}:${columnType(rows, k)}`).join(",")}}`;
  const lines = rows.map((r) => keys.map((k) => (r.has(k) ? csvCell(r.get(k)?.text ?? "") : "")).join(","));
  return `${header}\n${lines.join("\n")}\n`;
}

/** Synchronous core of the built-in engine. Never throws. */
export function compressBuiltin(payload: string): CompressOutcome {
  const items = parseJsonArray(payload);
  if (!items) return { kind: "skipped", reason: "no built-in encoder for this content" };
  const text = crushJsonArray(items);
  const tokensBefore = estimateTokens(payload);
  const tokensAfter = estimateTokens(text);
  const ratio = tokensBefore > 0 ? Math.round((tokensAfter / tokensBefore) * 100) / 100 : 1;
  const transforms = [`builtin:json-table:${ratio}`];
  const decision = acceptCompression({ tokensBefore, tokensAfter, transforms }, text);
  if (!decision.accept) return { kind: "skipped", reason: decision.reason };
  return { kind: "compressed", provider: "builtin", text, tokensBefore, tokensAfter, transforms };
}

/** The default PayloadCompressor: on-device, no install, no network. */
export const builtinCompress: PayloadCompressor = async (payload) => compressBuiltin(payload);
