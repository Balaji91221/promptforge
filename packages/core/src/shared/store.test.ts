import { describe, it, expect } from "vitest";
import { EventStore, InMemoryBackend } from "./store.js";
import type { PromptEvent } from "@promptforge/types";

function event(id: string, outcome: PromptEvent["outcome"]): PromptEvent {
  return {
    id, ts: 1, platform: "claude", raw_input: "x",
    result: {
      intent: "other", refined_prompt: "y",
      applied_techniques: [], suggestions: [],
      quality_before: 0, quality_after: 0,
    },
    outcome,
  };
}

describe("EventStore", () => {
  it("appends and reads back events", async () => {
    const s = new EventStore(new InMemoryBackend());
    await s.append(event("a", "accepted"));
    await s.append(event("b", "dismissed"));
    expect((await s.all()).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("records outcomes after the fact", async () => {
    const s = new EventStore(new InMemoryBackend());
    await s.append(event("a", null));
    await s.recordOutcome("a", "accepted");
    expect((await s.all())[0]!.outcome).toBe("accepted");
  });

  it("computes the G0 acceptance rate (accepted+edited over decided)", async () => {
    const s = new EventStore(new InMemoryBackend());
    await s.append(event("a", "accepted"));
    await s.append(event("b", "edited_then_sent"));
    await s.append(event("c", "dismissed"));
    await s.append(event("d", null)); // undecided — excluded
    expect(await s.acceptanceRate()).toBeCloseTo(2 / 3);
  });

  it("returns 0 acceptance with no decided events", async () => {
    const s = new EventStore(new InMemoryBackend());
    expect(await s.acceptanceRate()).toBe(0);
  });
});
