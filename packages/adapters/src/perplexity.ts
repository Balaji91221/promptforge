// Perplexity adapter (Phase 1).
import type { ProviderAdapter } from "./types.js";

export const perplexityAdapter: ProviderAdapter = {
  id: "perplexity",
  displayName: "Perplexity",
  hosts: ["https://www.perplexity.ai/*"],
  detectModel: () => "perplexity (web)",
  webSelectors: {
    input: 'textarea[placeholder], div[contenteditable="true"]',
    sendButton: 'button[aria-label="Submit"]',
  },
};
