// Google / Gemini adapter (Phase 1).
import type { ProviderAdapter } from "./types.js";

export const googleAdapter: ProviderAdapter = {
  id: "google",
  displayName: "Gemini",
  hosts: ["https://gemini.google.com/*"],
  detectModel: () => "gemini (web)",
  webSelectors: {
    input: 'div.ql-editor[contenteditable="true"]',
    sendButton: 'button[aria-label="Send message"]',
  },
};
