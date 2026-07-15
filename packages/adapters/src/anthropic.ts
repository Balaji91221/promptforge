// Anthropic / Claude.ai adapter — the single Phase 0 platform.
// Selectors live here (and mirror config/selectors.json) so a store-safe
// minimal host permission can be requested for exactly this site (§16).

import type { ProviderAdapter } from "./types.js";

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  displayName: "Claude",
  hosts: ["https://claude.ai/*"],
  detectModel: () => "claude (web)",
  webSelectors: {
    // Claude.ai uses a contenteditable ProseMirror composer.
    input: 'div[contenteditable="true"].ProseMirror',
    sendButton: 'button[aria-label="Send message"]',
  },
};
