// Unified LLM provider layer (plan §9.1 "provider-agnostic"). One compact
// abstraction powers the model dropdown across every surface.
//
// Almost every host speaks the OpenAI chat.completions protocol — NVIDIA NIM,
// OpenAI, Ollama (local), HuggingFace router, OpenRouter, and any custom
// endpoint. Anthropic is the single exception, handled separately. Adding a
// provider = one entry in PROVIDERS; adding a model = one string.

import type { LlmCall } from "./index.js";

export type ProviderId =
  | "nvidia" | "openai" | "anthropic" | "ollama" | "huggingface" | "openrouter" | "custom";

export interface ModelOption { id: string; label: string; note?: string }

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  wire: "openai" | "anthropic";
  baseUrl: string;      // default; editable for ollama/custom
  needsKey: boolean;
  keyHint?: string;
  editableBaseUrl?: boolean;
  allowCustomModel?: boolean;
  models: ModelOption[]; // curated dropdown; first entry is the recommended default
}

// Curated catalog — first model per provider is the recommended default.
export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  nvidia: {
    id: "nvidia", label: "NVIDIA NIM (free)", wire: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1", needsKey: true, keyHint: "nvapi-…",
    allowCustomModel: true,
    models: [
      { id: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B", note: "recommended · fast (~1s), reliable" },
      { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", note: "best quality · can be slow on free tier" },
      { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B", note: "NVIDIA-tuned · slower" },
      { id: "qwen/qwen2.5-72b-instruct", label: "Qwen2.5 72B", note: "strong multilingual · slower" },
    ],
  },
  openai: {
    id: "openai", label: "OpenAI", wire: "openai",
    baseUrl: "https://api.openai.com/v1", needsKey: true, keyHint: "sk-…", allowCustomModel: true,
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", note: "recommended · cheap/fast" },
      { id: "gpt-4o", label: "GPT-4o", note: "higher quality" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
  anthropic: {
    id: "anthropic", label: "Anthropic", wire: "anthropic",
    baseUrl: "https://api.anthropic.com/v1", needsKey: true, keyHint: "sk-ant-…", allowCustomModel: true,
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "recommended · fast/cheap" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "higher quality" },
    ],
  },
  ollama: {
    id: "ollama", label: "Ollama (local)", wire: "openai",
    baseUrl: "http://localhost:11434/v1", needsKey: false, editableBaseUrl: true, allowCustomModel: true,
    models: [
      { id: "llama3.1:8b", label: "Llama 3.1 8B", note: "recommended local" },
      { id: "qwen2.5:7b", label: "Qwen2.5 7B" },
      { id: "mistral", label: "Mistral 7B" },
      { id: "phi3", label: "Phi-3" },
    ],
  },
  huggingface: {
    id: "huggingface", label: "HuggingFace", wire: "openai",
    baseUrl: "https://router.huggingface.co/v1", needsKey: true, keyHint: "hf_…", allowCustomModel: true,
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B" },
      { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5 72B" },
      { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B" },
    ],
  },
  openrouter: {
    id: "openrouter", label: "OpenRouter (any OSS)", wire: "openai",
    baseUrl: "https://openrouter.ai/api/v1", needsKey: true, keyHint: "sk-or-…", allowCustomModel: true,
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
      { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen2.5 72B" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
    ],
  },
  custom: {
    id: "custom", label: "Custom (OpenAI-compatible)", wire: "openai",
    baseUrl: "", needsKey: false, editableBaseUrl: true, allowCustomModel: true,
    keyHint: "optional",
    models: [{ id: "", label: "— enter model id —" }],
  },
};

export interface LlmConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string; // overrides the provider default (ollama/custom)
}

export function defaultConfig(provider: ProviderId = "nvidia"): LlmConfig {
  const spec = PROVIDERS[provider];
  return { provider, model: spec.models[0]?.id ?? "", baseUrl: spec.baseUrl };
}

export interface ConnTest { ok: boolean; ms: number; sample?: string; error?: string }

/** Make a tiny real call to verify the provider/model/key work end-to-end.
 *  Runs the SAME code path as a rewrite, so a pass means Forge will work. */
export async function testProvider(cfg: LlmConfig): Promise<ConnTest> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  try {
    const out = await buildLlmCall(cfg)(
      "You are a connectivity check. Reply with one short word.",
      "Reply with exactly: OK",
    );
    const ms = Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0);
    return { ok: true, ms, sample: out.trim().slice(0, 60) };
  } catch (e) {
    const ms = Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0);
    return { ok: false, ms, error: (e as Error).message };
  }
}

/** Build an LlmCall for any configured provider. Streaming is intentionally
 *  omitted here — the eval + BYO paths use a single request; hosted streaming
 *  lives in the backend. */
export function buildLlmCall(cfg: LlmConfig): LlmCall {
  const spec = PROVIDERS[cfg.provider];
  const baseUrl = (cfg.baseUrl || spec.baseUrl).replace(/\/$/, "");
  const key = cfg.apiKey ?? "";

  // Abort a request that hangs (e.g. a cold-starting big model on a free tier)
  // so the UI shows a clear error instead of spinning forever.
  const TIMEOUT_MS = 30_000;
  const timeoutSignal = () =>
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(TIMEOUT_MS)
      : undefined;
  const wrap = (e: unknown): Error => {
    const msg = (e as Error)?.name === "TimeoutError" || /timed out|timeout/i.test((e as Error)?.message ?? "")
      ? `model timed out after ${TIMEOUT_MS / 1000}s — try a smaller/faster model (e.g. Llama 3.1 8B)`
      : (e as Error)?.message ?? "request failed";
    return new Error(msg);
  };

  if (spec.wire === "anthropic") {
    return async (system, user) => {
      try {
        const res = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: cfg.model, max_tokens: 1024, system, messages: [{ role: "user", content: user }] }),
          signal: timeoutSignal(),
        });
        if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
        const data = (await res.json()) as { content: { text: string }[] };
        return data.content.map((c) => c.text).join("");
      } catch (e) { throw wrap(e); }
    };
  }

  // OpenAI-compatible (NVIDIA, OpenAI, Ollama, HF, OpenRouter, custom)
  return async (system, user) => {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          temperature: 0.2, top_p: 0.7, max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
        signal: timeoutSignal(),
      });
      if (!res.ok) throw new Error(`${cfg.provider} ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return data.choices.map((c) => c.message.content).join("");
    } catch (e) { throw wrap(e); }
  };
}
