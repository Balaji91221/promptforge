// Dashboard home (server component). Pulls the summary and renders the
// headline quality trend + the G0/G1 signal tiles.
import { demoSummary, summarize, type Summary } from "../lib/analytics";
import { QualityTrend } from "../components/QualityTrend";
import { StatTile } from "../components/StatTile";

async function getSummary(): Promise<Summary> {
  // Phase 1: read synced events from the analytics store. Falls back to demo
  // data until real sync is wired (keeps the page renderable in dev).
  const base = process.env.PF_BACKEND;
  if (base) {
    try {
      const res = await fetch(`${base}/analytics/events`, { cache: "no-store" });
      if (res.ok) return summarize(await res.json());
    } catch {
      /* fall through to demo */
    }
  }
  return demoSummary();
}

export default async function Page() {
  const s = await getSummary();
  const accept = Math.round(s.acceptanceRate * 100);
  return (
    <main className="wrap">
      <p className="eyebrow">⚒ PromptForge</p>
      <h1>Your prompting, measured</h1>
      <p className="sub">Across every AI tool you use — the trend that lives with you, not any one provider.</p>

      <div className="grid">
        <StatTile label="Acceptance rate" value={`${accept}%`} foot="G0 target ≥ 40%"
          tone={accept >= 40 ? "good" : "warn"} />
        <StatTile label="Platforms used" value={String(s.platformsUsed)} foot="G1 target ≥ 2" />
        <StatTile label="Rewrites" value={s.totalRewrites.toLocaleString()} />
        <StatTile label="Extra messages" value={`+${s.extraMessages}`} foot={`~${s.tokensSaved.toLocaleString()} tokens saved`} />
      </div>

      <QualityTrend data={s.trend} />
    </main>
  );
}
