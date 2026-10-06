import { describe, it, expect } from "vitest";
import { resolveConfig } from "./config.js";
import { forgePrompt } from "./forge-tool.js";

const GOOD = JSON.stringify({
  intent: "code",
  refined_prompt: "Fix the login bug: share the failing flow, expected vs actual, and the relevant code. Return root cause and a minimal patch.",
  applied_techniques: ["clarity", "output format"],
  suggestions: ["add the error message"],
  quality_before: 25,
  quality_after: 80,
});
const INPUT = "fix my login bug it keeps failing";

describe("resolveConfig", () => {
  it("missing → hint, no provider", () => {
    const r = resolveConfig({});
    expect(r.kind).toBe("missing");
  });
  it("unknown PF_PROVIDER → invalid", () => {
    expect(resolveConfig({ PF_PROVIDER: "nope" }).kind).toBe("invalid");
  });
  it("keyed provider without key → invalid", () => {
    expect(resolveConfig({ PF_PROVIDER: "openai" }).kind).toBe("invalid");
  });
  it("ollama needs no key", () => {
    const r = resolveConfig({ PF_PROVIDER: "ollama" });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.cfg.baseUrl).toContain("11434");
  });
  it("NVIDIA_API_KEY shortcut", () => {
    const r = resolveConfig({ NVIDIA_API_KEY: "nvapi-x" });
    expect(r.kind === "ok" && r.cfg.provider).toBe("nvidia");
  });
});

describe("forgePrompt", () => {
  it("ok: returns the parsed result with token delta", async () => {
    const out = await forgePrompt(INPUT, { call: async () => GOOD });
    expect(out.status).toBe("ok");
    if (out.status === "ok") {
      expect(out.refined_prompt).toMatch(/login bug/);
      expect(out.applied_techniques).toEqual(["clarity", "output format"]);
      expect(out.tokens_before).toBeTypeOf("number");
    }
  });
  it("too_short: no model call", async () => {
    let calls = 0;
    const out = await forgePrompt("hi", { call: async () => { calls++; return GOOD; } });
    expect(out.status).toBe("too_short");
    expect(calls).toBe(0);
  });
  it("no provider → error.no_provider", async () => {
    const out = await forgePrompt(INPUT, { env: {} });
    expect(out).toMatchObject({ status: "error", error: "no_provider" });
  });
  it("model throws → error.model_failed", async () => {
    const out = await forgePrompt(INPUT, { call: async () => { throw new Error("custom 500: boom"); } });
    expect(out).toMatchObject({ status: "error", error: "model_failed", hint: "custom 500: boom" });
  });
  it("model returns prose → error.bad_model_output", async () => {
    const out = await forgePrompt(INPUT, { call: async () => "Sure! Here is a better prompt for you." });
    expect(out).toMatchObject({ status: "error", error: "bad_model_output" });
  });
  it("deflection is converted to a directive prompt (core guard)", async () => {
    const deflect = JSON.stringify({ ...JSON.parse(GOOD), refined_prompt: "Could you help me rephrase what you need?" });
    const out = await forgePrompt(INPUT, { call: async () => deflect });
    expect(out.status === "ok" && out.refined_prompt).toMatch(/I need help with/);
  });
  it("debug log line never contains the key", async () => {
    const lines: string[] = [];
    await forgePrompt(INPUT, { call: async () => GOOD, log: (l) => lines.push(l), env: { PF_API_KEY: "sk-SECRET" } });
    expect(lines.join("\n")).not.toContain("sk-SECRET");
    expect(lines[0]).toMatch(/\[promptforge-mcp\] .* \d+ms ok/);
  });
});
