// Paste splitter — separates the user's instruction from a large structured
// payload so the payload can be compressed locally and appended verbatim,
// instead of being pushed through the rewrite model (which cannot echo it back
// within its output budget). Deterministic, no I/O.
//
// The gate is deliberately strict: a top-level JSON array with ≥ 2 items is the
// only shape the spike proved lossless (docs/spikes/2026-09-09-headroom-compress.md).
// Prose, logs, CSV and JSON objects are left untouched and flow through the
// normal pipeline.

export const MIN_PAYLOAD_ITEMS = 2;

export type PasteSplit =
  | { kind: "plain"; text: string }
  | {
      kind: "paste";
      /** the user's words, may be empty when only data was pasted */
      instruction: string;
      /** the pasted data with outer whitespace trimmed, otherwise byte-for-byte */
      payload: string;
      order: "instruction-first" | "payload-first";
      itemCount: number;
    };

/** Item count when `text` is a JSON array with ≥ MIN_PAYLOAD_ITEMS items, else null.
 *  JSON.parse is used only as a validity check; the text is never re-serialised. */
export function looksLikeJsonArray(text: string): number | null {
  const t = text.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return null;
  try {
    const v: unknown = JSON.parse(t);
    return Array.isArray(v) && v.length >= MIN_PAYLOAD_ITEMS ? v.length : null;
  } catch {
    return null;
  }
}

const BLANK_LINE = /\r?\n[ \t]*\r?\n/g;

function boundaries(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(BLANK_LINE)) {
    if (m.index !== undefined) out.push(m.index + m[0].length);
  }
  return out;
}

function paste(
  instruction: string,
  payload: string,
  order: "instruction-first" | "payload-first",
  itemCount: number,
): PasteSplit {
  return { kind: "paste", instruction: instruction.trim(), payload: payload.trim(), order, itemCount };
}

/** Split `raw` into instruction + JSON-array payload when such a payload exists. */
export function splitPaste(raw: string): PasteSplit {
  const whole = looksLikeJsonArray(raw);
  if (whole !== null) return paste("", raw, "payload-first", whole);

  // Try every blank-line boundary: the array must be the whole tail
  // (instruction first) or the whole head (payload first). Multi-paragraph
  // instructions therefore work in either order.
  const cuts = boundaries(raw);
  for (const cut of cuts) {
    const tail = raw.slice(cut);
    const n = looksLikeJsonArray(tail);
    if (n !== null) return paste(raw.slice(0, cut), tail, "instruction-first", n);
  }
  for (const cut of cuts) {
    const head = raw.slice(0, cut);
    const n = looksLikeJsonArray(head);
    if (n !== null) return paste(raw.slice(cut), head, "payload-first", n);
  }

  // No blank line: try a single-line instruction before or after the data.
  const nl = raw.indexOf("\n");
  if (nl !== -1) {
    const n = looksLikeJsonArray(raw.slice(nl + 1));
    if (n !== null) return paste(raw.slice(0, nl), raw.slice(nl + 1), "instruction-first", n);
  }
  const lastNl = raw.lastIndexOf("\n");
  if (lastNl !== -1) {
    const n = looksLikeJsonArray(raw.slice(0, lastNl));
    if (n !== null) return paste(raw.slice(lastNl + 1), raw.slice(0, lastNl), "payload-first", n);
  }
  return { kind: "plain", text: raw };
}
