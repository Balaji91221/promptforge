// Config loader (plan §9.4, §11). Fetches versioned remote config (limits,
// pricing refs, selectors, meta-prompts, templates); falls back to bundled
// defaults offline. Remote from Phase 2; bundled-only before. Cached locally.
import type { KeyValueBackend } from "./store.js";

export interface RemoteConfig {
  version: string;
  metaPromptVersion: string;
  selectors: Record<string, { input: string; sendButton: string }>;
}

const CACHE_KEY = "pf:config";

export class ConfigLoader {
  constructor(
    private backend: KeyValueBackend,
    private bundled: RemoteConfig,
    private remoteUrl?: string,
  ) {}

  /** Return cached-or-bundled immediately; refresh from remote in background. */
  async load(): Promise<RemoteConfig> {
    const cached = (await this.backend.get(CACHE_KEY)) as RemoteConfig | undefined;
    return cached ?? this.bundled;
  }

  /** Pull the latest config; keep the newer version (by string compare). */
  async refresh(): Promise<RemoteConfig> {
    if (!this.remoteUrl) return this.bundled;
    try {
      const res = await fetch(this.remoteUrl, { cache: "no-store" });
      if (!res.ok) return this.load();
      const next = (await res.json()) as RemoteConfig;
      const current = await this.load();
      if (next.version > current.version) {
        await this.backend.set(CACHE_KEY, next);
        return next;
      }
      return current;
    } catch {
      return this.load();
    }
  }
}
