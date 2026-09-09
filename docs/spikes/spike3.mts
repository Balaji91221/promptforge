// Follow-up probes, one variable each:
//  P1 prose ×3 length  → is prose 0% because of size?
//  P2 repetitive log   → does "log run-collapse" trigger and beat 24%?
//  P3 output quoting   → is the compressed payload a JSON-string literal?
const NONCE = Date.now(); const BASE = "http://127.0.0.1:8787";
async function compress(messages: unknown[]) {
  const t = performance.now();
  const res = await fetch(`${BASE}/v1/compress`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, model: "gpt-4o" }), signal: AbortSignal.timeout(60_000) });
  const d = await res.json() as { messages: { content: string }[]; tokens_before: number; tokens_after: number; transforms_applied: string[] };
  return { ms: Math.round(performance.now() - t), ...d };
}
const report = (name: string, r: Awaited<ReturnType<typeof compress>>, preserve: string[]) => {
  const out = r.messages.map((m) => m.content).join("\n");
  const lost = preserve.filter((s) => !out.includes(s));
  console.log(`${name.padEnd(22)} ${String(r.tokens_before).padStart(6)} → ${String(r.tokens_after).padStart(6)}  saved ${String(Math.round((1 - r.tokens_after / r.tokens_before) * 100)).padStart(3)}%  ${String(r.ms).padStart(5)}ms  lost=${lost.length ? lost.join("|") : "none"}  transforms=${r.transforms_applied.join(",")}`);
  return out;
};

const paras = [
  "Autoscaling in Kubernetes is usually introduced as a single feature, but in practice it is three separate control loops that rarely agree with each other. The Horizontal Pod Autoscaler adds or removes replicas based on an observed metric, most often CPU. The Vertical Pod Autoscaler resizes the requests of existing pods. The Cluster Autoscaler adds or removes nodes when pods cannot be scheduled or when nodes sit idle. Each loop has its own polling interval, its own stabilisation window, and its own opinion about what enough means.",
  "Teams that adopt all three at once tend to see oscillation. A burst of traffic raises CPU, the HPA scales out, the new pods cannot be scheduled, the Cluster Autoscaler adds a node, and by the time the node is ready the burst is over. The HPA then scales in, the node drains, and the cycle repeats on the next burst. The fix is not to disable autoscaling but to make the loops slower than the workload they react to, and to scale on a signal closer to the actual work than CPU.",
  "That signal is usually queue depth or requests in flight. KEDA, the Kubernetes Event-Driven Autoscaler, exists to feed exactly those signals into the HPA. Instead of asking how hot is the CPU, it asks how many messages are waiting in the topic or how many jobs are queued in Redis. Because the metric leads the load rather than lagging it, the scaler can react before latency degrades, and it can scale to zero when the queue is empty, which CPU-based scaling can never do safely.",
  "The cost side is where this gets interesting for a platform team. In one migration we measured, moving a batch-processing fleet from CPU-based HPA to KEDA-driven scaling on queue depth produced a 37% cost reduction over a quarter, almost entirely from scale-to-zero during off-peak hours. The p95 latency during peak did not change. What did change was the number of on-call pages about pods pending, which dropped from roughly twelve per month to two.",
  "None of this removes the need for sensible requests and limits. The VPA can recommend values, and in recommendation-only mode it is safe to run everywhere. In its automatic mode it evicts pods to apply new requests, which interacts badly with the HPA and is the most common source of surprising restarts. Most teams should run VPA as an advisor and apply its numbers by hand in the deployment manifests during a normal release.",
  "The last piece is the stabilisation window. The HPA defaults to five minutes for scale-down and zero for scale-up. For queue-driven workloads that is usually right. For request-driven services behind a load balancer, a longer scale-down window and a small scale-up step avoid the sawtooth pattern that shows up in almost every cluster that turned autoscaling on with the defaults and never revisited them.",
];
// P1: ~3x longer prose, distinct-looking paragraphs (prefix each copy so it's not pure duplication)
const long = [0, 1, 2].flatMap((k) => paras.map((p, i) => `Section ${k * 6 + i + 1}. ${p}`)).join("\n\n");
const p1 = await compress([{ role: "user", content: `summarize in 5 bullets for my team, keep the numbers (ticket ${NONCE})\n\n${long}` }]);
report("P1 prose x3", p1, ["summarize in 5 bullets", "KEDA", "37%", "twelve per month to two"]);

// P2: highly repetitive log (4 line patterns × 320 lines) + one traceback
const rep: string[] = [];
for (let i = 0; i < 320; i++) rep.push(`2026-09-08T10:15:${String(i % 60).padStart(2, "0")}Z INFO worker-${i % 4} heartbeat ok queue_depth=0`);
rep.splice(200, 0, `2026-09-08T10:18:20Z ERROR worker-2 req=req-7f3a9c GatewayTimeout: stripe capture timed out after 30s`, `  File "/app/payments/service.py", line 212, in capture`);
const p2 = await compress([{ role: "user", content: `fix this error, under 5 bullets (ticket ${NONCE})\n\n${rep.join("\n")}` }]);
const out2 = report("P2 repetitive log", p2, ["GatewayTimeout", "service.py", "212", "req-7f3a9c", "under 5 bullets"]);
console.log("  P2 output lines:", out2.split("\n").length, "| head:", JSON.stringify(out2.split("\n").slice(2, 6)));

// P3: quoting quirk on JSON payload
const arr = Array.from({ length: 40 }, (_, i) => ({ id: `doc-${i}`, title: `Report ${i}`, score: 1 - i / 50 }));
const p3 = await compress([{ role: "user", content: `summarize (ticket ${NONCE})\n\n${JSON.stringify(arr, null, 2)}` }]);
const out3 = report("P3 json quoting", p3, ["summarize", "doc-17"]);
const payload = out3.slice(out3.indexOf("\n\n") + 2);
console.log("  P3 payload starts with quote?", payload.startsWith('"'), "| literal backslash-n count:", (payload.match(/\\n/g) ?? []).length, "| real newlines:", (payload.match(/\n/g) ?? []).length);
console.log("  P3 payload head:", JSON.stringify(payload.slice(0, 160)));
