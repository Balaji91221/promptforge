import { describe, it, expect, vi, afterEach } from "vitest";
import { PROVIDERS, defaultConfig, buildLlmCall } from "./providers.js";

afterEach(() => vi.restoreAllMocks());

describe("provider catalog", () => {
  it("covers all seven providers", () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(
      ["anthropic", "custom", "huggingface", "nvidia", "ollama", "openai", "openrouter"].sort(),
    );
  });

  it("every provider has a default model except custom", () => {
    for (const p of Object.values(PROVIDERS)) {
      if (p.id === "custom") continue;
      expect(p.models[0]?.id, p.id).toBeTruthy();
    }
  });

  it("ollama needs no key; cloud providers do", () => {
    expect(PROVIDERS.ollama.needsKey).toBe(false);
    expect(PROVIDERS.nvidia.needsKey).toBe(true);
    expect(PROVIDERS.openai.needsKey).toBe(true);
  });

  it("defaultConfig picks the provider's first model", () => {
    const cfg = defaultConfig("nvidia");
    expect(cfg.model).toBe(PROVIDERS.nvidia.models[0]!.id);
    expect(cfg.baseUrl).toBe(PROVIDERS.nvidia.baseUrl);
  });
});

describe("buildLlmCall (openai wire)", () => {
  it("sends system+user messages and returns content", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    const call = buildLlmCall({ provider: "custom", model: "m", baseUrl: "http://x/v1", apiKey: "k" });
    const out = await call("SYS", "USER");
    expect(out).toBe("{}");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://x/v1/chat/completions");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages).toEqual([
      { role: "system", content: "SYS" },
      { role: "user", content: "USER" },
    ]);
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer k" });
  });

  it("omits the auth header when no key is set (ollama/custom)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }),
    );
    await buildLlmCall({ provider: "ollama", model: "llama3.1:8b" })("s", "u");
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("throws a descriptive error on upstream failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("quota exceeded", { status: 429 }));
    const call = buildLlmCall({ provider: "custom", model: "m", baseUrl: "http://x/v1" });
    await expect(call("s", "u")).rejects.toThrow(/429/);
  });
});

describe("buildLlmCall (anthropic wire)", () => {
  it("uses x-api-key and the messages endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: "hello" }] }), { status: 200 }),
    );
    const cfg = { ...defaultConfig("anthropic"), apiKey: "sk-ant-x" };
    const out = await buildLlmCall(cfg)("SYS", "USER");
    expect(out).toBe("hello");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/messages");
    expect((init as RequestInit).headers).toMatchObject({ "x-api-key": "sk-ant-x" });
  });
});
