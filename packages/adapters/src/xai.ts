// xAI / Grok adapter (Phase 1).
import type { ProviderAdapter } from "./types.js";

export const xaiAdapter: ProviderAdapter = {
  id: "xai",
  displayName: "Grok",
  hosts: ["https://grok.com/*", "https://x.com/i/grok*"],
  detectModel: () => "grok (web)",
  webSelectors: {
    input: 'textarea[aria-label="Ask Grok anything"], textarea',
    sendButton: 'button[aria-label="Submit"]',
  },
};
