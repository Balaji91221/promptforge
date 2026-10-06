// Provider config from env. Node-only on purpose: packages/core must stay
// browser-safe, so the env lookup lives in the shell, not in core.
// Mirrors evals/runner.ts resolveConfig() — keep the two in sync (debt:
// extract to a shared node-only module when a third copy appears).
import { PROVIDERS, defaultConfig, type LlmConfig, type ProviderId } from "@promptforge/core";

export type ConfigResult =
  | { kind: "ok"; cfg: LlmConfig }
  | { kind: "missing"; hint: string }
  | { kind: "invalid"; hint: string };

const HINT =
  "Set PF_PROVIDER + PF_MODEL + PF_API_KEY (+ PF_BASE_URL for ollama/custom) " +
  "in the MCP server env, or the shortcut NVIDIA_API_KEY / ANTHROPIC_API_KEY. " +
  `Providers: ${Object.keys(PROVIDERS).join(", ")}.`;

function isProviderId(v: string): v is ProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, v);
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): ConfigResult {
  const provider = env.PF_PROVIDER;
  if (provider) {
    if (!isProviderId(provider)) {
      return { kind: "invalid", hint: `unknown PF_PROVIDER "${provider}". ${HINT}` };
    }
    const spec = PROVIDERS[provider];
    const cfg: LlmConfig = {
      provider,
      model: env.PF_MODEL || spec.models[0]?.id || "",
      apiKey: env.PF_API_KEY,
      baseUrl: env.PF_BASE_URL || spec.baseUrl,
    };
    if (!cfg.model) return { kind: "invalid", hint: `PF_MODEL is required for provider "${provider}".` };
    if (spec.needsKey && !cfg.apiKey) {
      return { kind: "invalid", hint: `provider "${provider}" needs PF_API_KEY.` };
    }
    return { kind: "ok", cfg };
  }
  if (env.NVIDIA_API_KEY) {
    const base = defaultConfig("nvidia");
    return { kind: "ok", cfg: { ...base, apiKey: env.NVIDIA_API_KEY, model: env.NVIDIA_MODEL || base.model } };
  }
  if (env.ANTHROPIC_API_KEY) {
    return { kind: "ok", cfg: { ...defaultConfig("anthropic"), apiKey: env.ANTHROPIC_API_KEY } };
  }
  return { kind: "missing", hint: HINT };
}

/** Label safe to log: provider + model, never the key. */
export function describeConfig(cfg: LlmConfig): string {
  return `${cfg.provider} · ${cfg.model}`;
}
