// Prompt-quality trend — the dashboard headline (plan §10, §15).
// Inline SVG (no chart lib, CSP-safe): faint grid, area fill under "after",
// muted "before" line for contrast, emphasized endpoint. Theme-aware via CSS
// vars. Quality is labeled ESTIMATED — behavior is the ground truth (§15).
import type { DailyQuality } from "../lib/analytics";

const W = 720;
const H = 220;
const PAD = { t: 16, r: 16, b: 24, l: 30 };

function path(points: [number, number][]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

export function QualityTrend({ data }: { data: DailyQuality[] }) {
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const n = Math.max(1, data.length - 1);
  const x = (i: number) => PAD.l + (i / n) * iw;
  const y = (v: number) => PAD.t + (1 - v / 100) * ih; // 0..100 scale

  const after = data.map((d, i) => [x(i), y(d.avgAfter)] as [number, number]);
  const before = data.map((d, i) => [x(i), y(d.avgBefore)] as [number, number]);
  const areaD = after.length
    ? `${path(after)} L${x(data.length - 1)},${PAD.t + ih} L${PAD.l},${PAD.t + ih} Z`
    : "";
  const last = after[after.length - 1];

  return (
    <div className="card">
      <p className="chart-title">Prompt quality over time</p>
      <p className="chart-note">Estimated clarity/specificity score · after (filled) vs. before (dotted)</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Prompt quality trend chart">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--grid)" strokeWidth={1} />
            <text x={4} y={y(g) + 4} fontSize={10} fill="var(--muted)">{g}</text>
          </g>
        ))}
        {areaD && <path d={areaD} fill="var(--ember)" opacity={0.12} />}
        <path d={path(before)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="3 3" />
        <path d={path(after)} fill="none" stroke="var(--ember)" strokeWidth={2.5} />
        {last && <circle cx={last[0]} cy={last[1]} r={4} fill="var(--ember)" stroke="var(--surface)" strokeWidth={2} />}
      </svg>
    </div>
  );
}
