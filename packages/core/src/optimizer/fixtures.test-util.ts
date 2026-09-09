// Test helper (not shipped): a pretty-printed JSON array large enough to pass the
// 400-token paste gate at 40 items (~1,300 tokens, spike P3) and small enough to
// stay under it at 3 items.
export function makeArray(n: number, extra: Record<string, unknown> = {}): string {
  const items = Array.from({ length: n }, (_, i) => ({
    id: `doc-${String(i).padStart(6, "0")}`,
    title: `Report ${i}: weekly metrics digest`,
    score: Math.round((1 - i / (n + 1)) * 1000) / 1000,
    tags: ["metrics", i % 2 ? "weekly" : "quarterly"],
    ...extra,
  }));
  return JSON.stringify(items, null, 2);
}
