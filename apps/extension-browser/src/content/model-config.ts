// Persisted model/provider choice for the extension (the dropdown state).
// Local-only. Key/baseUrl are stored in chrome.storage.local (device-scoped).
import { defaultConfig, type LlmConfig } from "@promptforge/core";

const KEY = "pf_model_config";

export async function getModelConfig(): Promise<LlmConfig> {
  const out = await chrome.storage.local.get(KEY);
  return (out[KEY] as LlmConfig) ?? defaultConfig("nvidia");
}

export async function setModelConfig(cfg: LlmConfig): Promise<void> {
  await chrome.storage.local.set({ [KEY]: cfg });
}

/** A BYO provider is usable if it needs no key (ollama) or a key was supplied. */
export function isConfigUsable(cfg: LlmConfig, needsKey: boolean): boolean {
  return !!cfg.model && (!needsKey || !!cfg.apiKey);
}
