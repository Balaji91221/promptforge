// Provider Adapter interface (plan §9.5). Adding a provider = adding an
// adapter, no engine changes. Phase 0 ships exactly one (Claude/Anthropic).

export interface LimitWindow {
  label: string; // e.g. "5-hour", "weekly"
  cap: number; // messages or tokens per window
}

export interface DomSelectors {
  /** CSS selector for the chat input box (browser shell). */
  input: string;
  /** CSS selector for the send button, used to anchor the overlay. */
  sendButton: string;
}

export interface ProviderAdapter {
  id: string; // "anthropic" | "openai" | "google" | "xai" ...
  displayName: string;
  hosts: string[]; // host permissions this adapter needs
  /** Best-effort model id detection from page context. */
  detectModel(ctx: { url: string }): string;
  webSelectors: DomSelectors;
}
