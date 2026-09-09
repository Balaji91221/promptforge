// Live end-to-end check of paste-mode compression on a 500-item JSON array with
// one 2,000-char string field (the shape that caught truncation risk in the spike).
//
//   npm run e2e:headroom
//
// The built-in engine always runs (no install). The Headroom section runs only
// when a real proxy answers at PF_HEADROOM_URL (default :8787) and is skipped
// otherwise with exit 0, so this is safe anywhere. The rewrite model is mocked.
import {
  refine, buildHeadroomCompress, builtinCompress, headroomHealth, estimateTokens, HEADROOM_DEFAULTS,
  type PayloadCompressor,
} from "@promptforge/core";

const cfg = { ...HEADROOM_DEFAULTS, baseUrl: process.env.PF_HEADROOM_URL ?? HEADROOM_DEFAULTS.baseUrl };

let seed = 7;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];
let big = "";
while (big.length < 2000) big += words[Math.floor(rnd() * words.length)] + (rnd() < 0.1 ? ". " : " ");
big = big.slice(0, 2000);
const N = 500;
const items = Array.from({ length: N }, (_, i) => ({
  id: `doc-${String(i).padStart(6, "0")}`, title: `Report ${i}`, score: Math.round((1 - i / 600) * 1000) / 1000,
  tags: ["metrics", i % 2 ? "weekly" : "quarterly"], body: i === 250 ? big : `short body ${i}`,
}));
const payload = JSON.stringify(items, null, 2);
// Nonce goes in the INSTRUCTION so each run defeats any cache while the payload stays a pure JSON array.
const rawFor = (label: string) =>
  `summarize the most relevant results for a non-technical manager, 3 bullets (${label} ${Date.now()})\n\n${payload}`;

const PASTE_JSON = JSON.stringify({
  intent: "summarize", refined_prompt: "Summarize the data below in 3 bullets for a non-technical manager.",
  applied_techniques: ["clarity", "audience"], suggestions: [], quality_before: 30, quality_after: 84,
});
const mockLlm = async () => PASTE_JSON;

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}${extra ? "  " + extra : ""}`);
  if (cond) pass++; else fail++;
};

async function runEngine(label: string, compress: PayloadCompressor): Promise<void> {
  console.log(`▸ ${label}: ${N}-item JSON paste (~${estimateTokens(payload)} est. tokens)`);
  const t0 = performance.now();
  const out = await refine(rawFor(label), mockLlm, { compress });
  const ms = Math.round(performance.now() - t0);
  const prompt = out.result?.refined_prompt ?? "";
  const c = out.result?.compression;
  check("forged", out.status === "ok", `${ms}ms total`);
  check("compression applied", c !== undefined,
    c ? `${c.tokens_before} → ${c.tokens_after} tokens (${Math.round((1 - c.tokens_after / c.tokens_before) * 100)}% saved) · ${c.transforms.join(",")}` : "(fell back)");
  if (c) {
    check("saved ≥ 40%", 1 - c.tokens_after / c.tokens_before >= 0.4);
    check(`all ${N} ids present`, items.every((it) => prompt.includes(it.id)));
    check("2,000-char string intact", prompt.includes(big));
    check("real newlines, no \\n-escaped payload", !prompt.includes("\\n") && prompt.split("\n").length > N);
  }
  console.log();
}

async function main() {
  await runEngine("built-in engine, run 1", builtinCompress);
  await runEngine("built-in engine, run 2", builtinCompress);

  const h = await headroomHealth(cfg);
  if (!h.ok) {
    console.log(`[headroom-live] Headroom section skipped: no proxy at ${cfg.baseUrl} (${h.error}). Start one with: headroom proxy\n`);
  } else {
    console.log(`[headroom-live] Headroom proxy ${h.version} at ${cfg.baseUrl} (${h.ms}ms)\n`);
    const compress = buildHeadroomCompress(cfg);
    await runEngine("Headroom engine, run 1 (may include cold start)", compress);
    await runEngine("Headroom engine, run 2", compress);
  }
  console.log(`${fail === 0 ? "✅ LIVE PASS" : "❌ LIVE FAILURES"} — ${pass} checks passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}
void main();
