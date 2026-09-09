import { describe, it, expect } from "vitest";
import { crushJsonArray, compressBuiltin, builtinCompress, csvCell, parseJsonArray, routeContent } from "./crusher.js";
import { makeArray } from "./fixtures.test-util.js";

/** Minimal RFC-4180 reader used only to prove the encoding round-trips. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cell); cell = ""; }
    else cell += ch;
  }
  out.push(cell);
  return out;
}
function parseTable(text: string): { count: number; keys: string[]; types: string[]; rows: string[][] } {
  const m = /^\[(\d+)\]\{([^}]*)\}\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error("bad header");
  const cols = (m[2] ?? "").split(",").map((c) => c.split(":"));
  // rows may contain quoted newlines: re-join lines that leave a quote open
  const rows: string[][] = [];
  let buf = "";
  for (const line of (m[3] ?? "").split("\n")) {
    buf = buf ? `${buf}\n${line}` : line;
    if ((buf.match(/"/g) ?? []).length % 2 === 0) { if (buf !== "") rows.push(parseCsvLine(buf)); buf = ""; }
  }
  return { count: Number(m[1]), keys: cols.map((c) => c[0] ?? ""), types: cols.map((c) => c[1] ?? ""), rows };
}

const TRICKY = [
  { id: "a,1", title: 'He said "hi"', note: "line1\nline2", score: 0.5, n: 3, ok: true, none: null,
    meta: { author: "u1", nested: { deep: { deeper: { tooDeep: 1 } } } }, tags: ["x", "y"] },
  { id: "b", title: "plain", score: 1, n: 4, ok: false, none: null, meta: { author: "u2", nested: { deep: { deeper: { tooDeep: 2 } } } }, tags: [] },
  { id: "c", extra: "only here", score: 2.5, n: 5, ok: true, none: null, meta: { author: "u3", nested: { deep: { deeper: { tooDeep: 3 } } } }, tags: ["z"] },
];

describe("crushJsonArray", () => {
  const text = crushJsonArray(TRICKY);
  const table = parseTable(text);

  it("emits [N]{schema} then one row per item", () => {
    expect(table.count).toBe(3);
    expect(table.rows).toHaveLength(3);
    expect(text.startsWith("[3]{id:string,title:string,note:string,")).toBe(true);
  });

  it("flattens nested objects to dot keys up to depth 3 and JSON-encodes deeper", () => {
    expect(table.keys).toContain("meta.author");
    expect(table.keys).toContain("meta.nested.deep.deeper");
    expect(table.rows[0]?.[table.keys.indexOf("meta.nested.deep.deeper")]).toBe('{"tooDeep":1}');
  });

  it("infers column types and marks mixed columns as any", () => {
    const t = (k: string) => table.types[table.keys.indexOf(k)];
    expect(t("id")).toBe("string");
    expect(t("n")).toBe("int");
    expect(t("score")).toBe("any"); // 0.5, 1, 2.5 → float + int
    expect(t("ok")).toBe("bool");
    expect(t("none")).toBe("null");
    expect(t("tags")).toBe("json");
  });

  it("round-trips every cell, including commas, quotes and newlines", () => {
    const col = (k: string) => table.keys.indexOf(k);
    expect(table.rows[0]?.[col("id")]).toBe("a,1");
    expect(table.rows[0]?.[col("title")]).toBe('He said "hi"');
    expect(table.rows[0]?.[col("note")]).toBe("line1\nline2");
    expect(table.rows[0]?.[col("tags")]).toBe('["x","y"]');
    expect(table.rows[1]?.[col("tags")]).toBe("[]");
    expect(table.rows[2]?.[col("extra")]).toBe("only here");
  });

  it("leaves a missing key as an empty cell", () => {
    expect(table.rows[0]?.[table.keys.indexOf("extra")]).toBe("");
  });

  it("keeps every id and title from a realistic fixture", () => {
    const items = JSON.parse(makeArray(40)) as { id: string; title: string }[];
    const out = crushJsonArray(items);
    for (const it of items) {
      expect(out).toContain(it.id);
      expect(out).toContain(it.title);
    }
  });
});

describe("csvCell", () => {
  it.each([
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ['say "x"', '"say ""x"""'],
    ["l1\nl2", '"l1\nl2"'],
  ])("encodes %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });
});

describe("routeContent / parseJsonArray", () => {
  it.each([
    ["prose", "summarize this"],
    ["object", '{"a":1}'],
    ["one item", "[{\"a\":1}]"],
    ["primitives", "[1,2,3]"],
    ["mixed", "[{\"a\":1}, 2]"],
    ["broken", "[{\"a\":1}"],
  ])("routes %s to unknown", (_n, text) => {
    expect(routeContent(text)).toBe("unknown");
    expect(parseJsonArray(text)).toBeNull();
  });
  it("routes an array of objects to json-array", () => {
    expect(routeContent(makeArray(3))).toBe("json-array");
  });
});

describe("compressBuiltin / builtinCompress", () => {
  it("compresses a realistic 40-item paste by at least 40% with a builtin transform id", async () => {
    const payload = makeArray(40);
    const out = await builtinCompress(payload, "summarize");
    expect(out.kind).toBe("compressed");
    if (out.kind !== "compressed") return;
    expect(out.provider).toBe("builtin");
    expect(out.transforms[0]).toMatch(/^builtin:json-table:0\.\d+$/);
    expect(1 - out.tokensAfter / out.tokensBefore).toBeGreaterThanOrEqual(0.4);
  });

  it("skips content it has no encoder for", () => {
    expect(compressBuiltin("just some prose that is long enough to matter")).toMatchObject({ kind: "skipped" });
    expect(compressBuiltin("[1,2,3]")).toMatchObject({ kind: "skipped" });
  });

  it("skips when the table would not save enough (allowlist applies to built-in too)", () => {
    // one tiny key per item: the header + rows are about as long as the source
    const items = Array.from({ length: 3 }, (_, i) => ({ a: `${i}` }));
    const out = compressBuiltin(JSON.stringify(items));
    expect(out.kind).toBe("skipped");
  });

  it("handles 500 items quickly", () => {
    const payload = makeArray(500, { body: "x".repeat(40) });
    const t0 = performance.now();
    const out = compressBuiltin(payload);
    const ms = performance.now() - t0;
    expect(out.kind).toBe("compressed");
    expect(ms).toBeLessThan(200);
  });
});
