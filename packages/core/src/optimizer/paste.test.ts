import { describe, it, expect } from "vitest";
import { splitPaste, looksLikeJsonArray } from "./paste.js";
import { makeArray } from "./fixtures.test-util.js";

const ARR = makeArray(40);

describe("looksLikeJsonArray", () => {
  it("returns the item count for a JSON array with ≥ 2 items", () => {
    expect(looksLikeJsonArray(ARR)).toBe(40);
    expect(looksLikeJsonArray("  [1, 2]  ")).toBe(2);
  });
  it.each([
    ["one item", "[1]"],
    ["object", '{"a": [1, 2, 3]}'],
    ["prose", "summarize this for me"],
    ["broken array", "[1, 2"],
    ["array-ish prose", "[draft] please review the list"],
  ])("rejects %s", (_name, text) => {
    expect(looksLikeJsonArray(text)).toBeNull();
  });
});

describe("splitPaste", () => {
  it("splits instruction-first with a blank line and keeps the payload byte-for-byte", () => {
    const s = splitPaste(`summarize\n\n${ARR}`);
    expect(s.kind).toBe("paste");
    if (s.kind !== "paste") return;
    expect(s.instruction).toBe("summarize");
    expect(s.payload).toBe(ARR);
    expect(s.order).toBe("instruction-first");
    expect(s.itemCount).toBe(40);
  });

  it("splits payload-first", () => {
    const s = splitPaste(`${ARR}\n\nfix the scores, 3 bullets`);
    expect(s.kind).toBe("paste");
    if (s.kind !== "paste") return;
    expect(s.instruction).toBe("fix the scores, 3 bullets");
    expect(s.payload).toBe(ARR);
    expect(s.order).toBe("payload-first");
  });

  it("handles a multi-paragraph instruction in either order", () => {
    const instr = "summarize this\n\nfor a non-technical manager";
    const a = splitPaste(`${instr}\n\n${ARR}`);
    const b = splitPaste(`${ARR}\n\n${instr}`);
    expect(a.kind === "paste" && a.instruction).toBe(instr);
    expect(b.kind === "paste" && b.instruction).toBe(instr);
  });

  it("splits on a single newline when there is no blank line", () => {
    const a = splitPaste(`summarize\n${ARR}`);
    const b = splitPaste(`${ARR}\nsummarize`);
    expect(a.kind === "paste" && a.instruction).toBe("summarize");
    expect(b.kind === "paste" && b.instruction).toBe("summarize");
  });

  it("handles CRLF line endings", () => {
    const s = splitPaste(`summarize\r\n\r\n${ARR.replace(/\n/g, "\r\n")}`);
    expect(s.kind).toBe("paste");
    expect(s.kind === "paste" && s.instruction).toBe("summarize");
  });

  it("returns an empty instruction for a bare data paste", () => {
    const s = splitPaste(ARR);
    expect(s.kind === "paste" && s.instruction).toBe("");
    expect(s.kind === "paste" && s.itemCount).toBe(40);
  });

  it.each([
    ["prose", "summarize this article for me please it is long"],
    ["json object", `summarize\n\n${JSON.stringify({ items: [1, 2, 3] }, null, 2)}`],
    ["one-item array", "summarize\n\n[{\"id\": 1}]"],
    ["array in the middle of prose", "look at [1, 2, 3] and tell me the sum"],
  ])("leaves %s as plain", (_name, text) => {
    expect(splitPaste(text)).toEqual({ kind: "plain", text });
  });
});
