import { describe, it, expect, vi, afterEach } from "vitest";
import {
  acceptCompression,
  buildCompressRequest,
  buildHeadroomCompress,
  headroomHealth,
  isLoopbackUrl,
  parseCompressResponse,
  HEADROOM_TOKENIZER_MODEL,
} from "./headroom.js";

afterEach(() => vi.unstubAllGlobals());

const CFG = { baseUrl: "http://127.0.0.1:8787", timeoutMs: 1500 };

/** Response shape copied from the spike (docs/spikes/spike-run4.txt, P5). */
function proxyResponse(over: Partial<Record<string, unknown>> = {}) {
  const req = buildCompressRequest("[]", "x");
  const msgs = req.messages as Record<string, unknown>[];
  const toolCallId = (msgs[2] as { tool_call_id: string }).tool_call_id;
  return {
    messages: [
      { role: "user", content: "summarize" },
      { role: "assistant", content: null },
      { role: "tool", tool_call_id: toolCallId, content: "[500]{id:string,title:string}\ndoc-0,Report 0\n" },
    ],
    tokens_before: 29239,
    tokens_after: 14755,
    tokens_saved: 14484,
    compression_ratio: 0.5,
    transforms_applied: ["router:mixed:0.41"],
    ccr_hashes: [],
    ...over,
  };
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("isLoopbackUrl", () => {
  it.each(["http://127.0.0.1:8787", "http://localhost:8787/", "https://localhost", "http://[::1]:8787"])(
    "accepts %s", (u) => expect(isLoopbackUrl(u)).toBe(true),
  );
  it.each(["http://example.com:8787", "http://10.0.0.5:8787", "ftp://localhost", "not a url", ""])(
    "rejects %s", (u) => expect(isLoopbackUrl(u)).toBe(false),
  );
});

describe("acceptCompression", () => {
  const ok = { tokensBefore: 1000, tokensAfter: 500, transforms: ["router:mixed:0.41"] };
  it("accepts a real saving from a structural transform", () => {
    expect(acceptCompression(ok, "data")).toEqual({ accept: true });
  });
  it("rejects empty output", () => {
    expect(acceptCompression(ok, "  \n").accept).toBe(false);
  });
  it("rejects when no transform was reported", () => {
    expect(acceptCompression({ ...ok, transforms: [] }, "data").accept).toBe(false);
  });
  it("rejects the ML prose route (router:text) — it dropped facts in the spike", () => {
    const d = acceptCompression({ ...ok, transforms: ["router:text:0.82"] }, "data");
    expect(d.accept).toBe(false);
    expect(d.accept === false && d.reason).toMatch(/router:text/);
  });
  it("rejects noop", () => {
    expect(acceptCompression({ ...ok, transforms: ["router:noop"] }, "data").accept).toBe(false);
  });
  it("rejects when nothing was saved", () => {
    expect(acceptCompression({ ...ok, tokensAfter: 1000 }, "data").accept).toBe(false);
  });
  it("rejects savings under 25%", () => {
    const d = acceptCompression({ ...ok, tokensAfter: 800 }, "data");
    expect(d.accept).toBe(false);
    expect(d.accept === false && d.reason).toMatch(/20% < 25%/);
  });
});

describe("parseCompressResponse", () => {
  it("parses the proxy shape and picks the tool message by tool_call_id", () => {
    const body = proxyResponse();
    body.messages.unshift({ role: "tool", tool_call_id: "other", content: "WRONG" });
    const p = parseCompressResponse(body);
    expect(p?.toolText).toContain("[500]");
    expect(p?.tokensBefore).toBe(29239);
    expect(p?.transforms).toEqual(["router:mixed:0.41"]);
  });
  it.each([
    ["not an object", "nope"],
    ["missing messages", { tokens_before: 1, tokens_after: 1, transforms_applied: [] }],
    ["no matching tool message", { ...proxyResponse(), messages: [{ role: "user", content: "x" }] }],
    ["tokens not numbers", proxyResponse({ tokens_before: "29239" })],
    ["transforms not strings", proxyResponse({ transforms_applied: [1, 2] })],
  ])("returns null for %s", (_n, body) => {
    expect(parseCompressResponse(body)).toBeNull();
  });
});

describe("buildHeadroomCompress", () => {
  it("posts the payload as a tool result with the constant tokenizer model", async () => {
    const fetchMock = stubFetch(200, proxyResponse());
    const out = await buildHeadroomCompress(CFG)("[1,2,3]", "summarize");
    expect(out.kind).toBe("compressed");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8787/v1/compress");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: { role: string; content: unknown; tool_calls?: { id: string }[]; tool_call_id?: string }[];
    };
    expect(body.model).toBe(HEADROOM_TOKENIZER_MODEL);
    expect(body.messages).toHaveLength(3);
    expect(body.messages[0]).toMatchObject({ role: "user", content: "summarize" });
    expect(body.messages[2]).toMatchObject({ role: "tool", content: "[1,2,3]" });
    expect(body.messages[2]?.tool_call_id).toBe(body.messages[1]?.tool_calls?.[0]?.id);
  });

  it("returns compressed text and stats on success", async () => {
    stubFetch(200, proxyResponse());
    const out = await buildHeadroomCompress(CFG)("[]", "x");
    expect(out).toMatchObject({ kind: "compressed", tokensBefore: 29239, tokensAfter: 14755 });
  });

  it("skips a lossy transform instead of using it", async () => {
    stubFetch(200, proxyResponse({ transforms_applied: ["router:text:0.82"] }));
    const out = await buildHeadroomCompress(CFG)("[]", "x");
    expect(out.kind).toBe("skipped");
  });

  it("fails on HTTP errors without throwing", async () => {
    stubFetch(500, { error: "boom" });
    const out = await buildHeadroomCompress(CFG)("[]", "x");
    expect(out.kind).toBe("failed");
    expect(out.kind === "failed" && out.error).toMatch(/500/);
  });

  it("fails on an unexpected response shape", async () => {
    stubFetch(200, { hello: "world" });
    expect((await buildHeadroomCompress(CFG)("[]", "x")).kind).toBe("failed");
  });

  it("fails with a clear timeout message when the proxy is slow", async () => {
    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    const out = await buildHeadroomCompress(CFG)("[]", "x");
    expect(out).toEqual({ kind: "failed", error: "timed out after 1500ms" });
  });

  it("fails when the proxy is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const out = await buildHeadroomCompress(CFG)("[]", "x");
    expect(out).toEqual({ kind: "failed", error: "fetch failed" });
  });
});

describe("headroomHealth", () => {
  it("reports ok with the proxy version", async () => {
    stubFetch(200, { status: "healthy", version: "0.37.0" });
    const h = await headroomHealth(CFG);
    expect(h.ok).toBe(true);
    expect(h.ok && h.version).toBe("0.37.0");
  });
  it("reports not-ok when the proxy is degraded or down", async () => {
    stubFetch(200, { status: "degraded", version: "0.37.0" });
    expect((await headroomHealth(CFG)).ok).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const down = await headroomHealth(CFG);
    expect(down).toMatchObject({ ok: false, error: "fetch failed" });
  });
});
