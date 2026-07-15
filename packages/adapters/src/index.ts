export type { ProviderAdapter, DomSelectors, LimitWindow } from "./types.js";
export { anthropicAdapter } from "./anthropic.js";
export { openaiAdapter } from "./openai.js";
export { googleAdapter } from "./google.js";
export { xaiAdapter } from "./xai.js";
export { perplexityAdapter } from "./perplexity.js";

import { anthropicAdapter } from "./anthropic.js";
import { openaiAdapter } from "./openai.js";
import { googleAdapter } from "./google.js";
import { xaiAdapter } from "./xai.js";
import { perplexityAdapter } from "./perplexity.js";
import type { ProviderAdapter } from "./types.js";

/** Registry — Phase 1 covers all major web chats. Add an adapter to expand. */
export const adapters: Record<string, ProviderAdapter> = {
  [anthropicAdapter.id]: anthropicAdapter,
  [openaiAdapter.id]: openaiAdapter,
  [googleAdapter.id]: googleAdapter,
  [xaiAdapter.id]: xaiAdapter,
  [perplexityAdapter.id]: perplexityAdapter,
};

/** All host-permission globs across adapters — feeds the MV3 manifest. */
export const allHosts: string[] = Object.values(adapters).flatMap((a) => a.hosts);

function hostToRegExp(h: string): RegExp {
  return new RegExp("^" + h.replace(/[.]/g, "\\.").replace(/\*/g, ".*"));
}

export function adapterForUrl(url: string): ProviderAdapter | undefined {
  return Object.values(adapters).find((a) => a.hosts.some((h) => hostToRegExp(h).test(url)));
}
