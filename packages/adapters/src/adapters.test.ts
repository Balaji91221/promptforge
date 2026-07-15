import { describe, it, expect } from "vitest";
import { adapters, adapterForUrl, allHosts } from "./index.js";

describe("adapter registry", () => {
  it("covers the five Phase 1 platforms", () => {
    expect(Object.keys(adapters).sort()).toEqual(
      ["anthropic", "google", "openai", "perplexity", "xai"].sort(),
    );
  });

  it.each([
    ["https://claude.ai/chat/abc", "anthropic"],
    ["https://chatgpt.com/c/123", "openai"],
    ["https://chat.openai.com/c/123", "openai"],
    ["https://gemini.google.com/app", "google"],
    ["https://grok.com/chat", "xai"],
    ["https://www.perplexity.ai/search", "perplexity"],
  ])("routes %s → %s", (url, id) => {
    expect(adapterForUrl(url)?.id).toBe(id);
  });

  it("returns undefined for unsupported hosts", () => {
    expect(adapterForUrl("https://example.com/")).toBeUndefined();
    // must not match lookalike domains
    expect(adapterForUrl("https://evil-claude.ai.attacker.com/")).toBeUndefined();
  });

  it("exposes host globs for the manifest", () => {
    expect(allHosts.length).toBeGreaterThanOrEqual(5);
    for (const h of allHosts) expect(h).toMatch(/^https:\/\//);
  });
});
