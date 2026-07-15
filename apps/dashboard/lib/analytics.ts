// Analytics aggregation (plan §11 Analytics/Usage Store). Reads synced
// PromptEvents/UsageEvents and produces the dashboard summary. Backed by
// Postgres in production (apps/backend/db/schema.sql); this module is the
// query layer. For local/dev it falls back to a deterministic demo series.

import type { PromptEvent } from "@promptforge/types";

export interface DailyQuality {
  day: string; // ISO date
  avgBefore: number;
  avgAfter: number;
  rewrites: number;
}

export interface Summary {
  acceptanceRate: number; // 0..1 — the G0 signal
  totalRewrites: number;
  platformsUsed: number; // G1 signal (≥2 platforms)
  tokensSaved: number;
  extraMessages: number; // "extra messages bought" within plan
  trend: DailyQuality[];
}

export function summarize(events: PromptEvent[]): Summary {
  const decided = events.filter((e) => e.outcome !== null);
  const accepted = decided.filter(
    (e) => e.outcome === "accepted" || e.outcome === "edited_then_sent",
  ).length;

  const byDay = new Map<string, DailyQuality>();
  let tokensSaved = 0;
  for (const e of events) {
    const day = new Date(e.ts).toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { day, avgBefore: 0, avgAfter: 0, rewrites: 0 };
    d.avgBefore += e.result.quality_before;
    d.avgAfter += e.result.quality_after;
    d.rewrites += 1;
    byDay.set(day, d);
    tokensSaved += Math.max(0, (e.result.tokens_before ?? 0) - (e.result.tokens_after ?? 0));
  }
  const trend = [...byDay.values()]
    .map((d) => ({ ...d, avgBefore: d.avgBefore / d.rewrites, avgAfter: d.avgAfter / d.rewrites }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    acceptanceRate: decided.length ? accepted / decided.length : 0,
    totalRewrites: events.length,
    platformsUsed: new Set(events.map((e) => e.platform)).size,
    tokensSaved,
    extraMessages: Math.round(tokensSaved / 400), // rough: ~400 tok/msg headroom
    trend,
  };
}

/** Deterministic demo data so the dashboard renders before real sync exists. */
export function demoSummary(): Summary {
  const days = 14;
  const trend: DailyQuality[] = [];
  for (let i = 0; i < days; i++) {
    const t = i / (days - 1);
    trend.push({
      day: `2026-07-${String(i + 1).padStart(2, "0")}`,
      avgBefore: 34 + Math.round(6 * Math.sin(i)),
      avgAfter: 62 + Math.round(20 * t), // improvement over time = the story
      rewrites: 5 + (i % 4),
    });
  }
  return {
    acceptanceRate: 0.47,
    totalRewrites: 128,
    platformsUsed: 3,
    tokensSaved: 21400,
    extraMessages: 53,
    trend,
  };
}
