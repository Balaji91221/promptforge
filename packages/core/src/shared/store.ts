// Local store (plan §9.4) — offline-first. Phase 0 is local-only:
// no accounts, no sync. A pluggable backend keeps core isomorphic
// (chrome.storage in the extension, in-memory in tests/eval).

import type { PromptEvent, Outcome } from "@promptforge/types";

export interface KeyValueBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const EVENTS_KEY = "pf:events";

export class InMemoryBackend implements KeyValueBackend {
  private m = new Map<string, unknown>();
  async get(key: string) {
    return this.m.get(key);
  }
  async set(key: string, value: unknown) {
    this.m.set(key, value);
  }
}

export class EventStore {
  constructor(private backend: KeyValueBackend) {}

  async all(): Promise<PromptEvent[]> {
    const raw = (await this.backend.get(EVENTS_KEY)) as PromptEvent[] | undefined;
    return raw ?? [];
  }

  async append(event: PromptEvent): Promise<void> {
    const events = await this.all();
    events.push(event);
    await this.backend.set(EVENTS_KEY, events);
  }

  /** Record the ground-truth signal (§7 gates depend on this). */
  async recordOutcome(id: string, outcome: Outcome): Promise<void> {
    const events = await this.all();
    const ev = events.find((e) => e.id === id);
    if (ev) {
      ev.outcome = outcome;
      await this.backend.set(EVENTS_KEY, events);
    }
  }

  /** Acceptance rate = (accepted + edited_then_sent) / decided. Drives G0. */
  async acceptanceRate(): Promise<number> {
    const events = await this.all();
    const decided = events.filter((e) => e.outcome !== null);
    if (decided.length === 0) return 0;
    const accepted = decided.filter(
      (e) => e.outcome === "accepted" || e.outcome === "edited_then_sent",
    ).length;
    return accepted / decided.length;
  }
}
