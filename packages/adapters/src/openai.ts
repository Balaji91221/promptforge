// OpenAI / ChatGPT adapter (Phase 1 — all web chats).
import type { ProviderAdapter } from "./types.js";

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  displayName: "ChatGPT",
  hosts: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  detectModel: () => "gpt (web)",
  webSelectors: {
    input: "#prompt-textarea",
    sendButton: 'button[data-testid="send-button"]',
  },
};
