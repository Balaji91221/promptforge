// R&D spike — ONE question: does Headroom's local /v1/compress save ≥30% tokens on
// realistic long pastes (log, JSON, prose) WITHOUT dropping strings the user's
// prompt must preserve? Throwaway: no error handling beyond printing.
const BASE = process.env.HR_BASE ?? "http://127.0.0.1:8787";
const MODEL = "gpt-4o";

// ---- three realistic pastes, each with a user instruction on top -------------
function logPaste(): { text: string; preserve: string[] } {
  const lines: string[] = [];
  const t0 = Date.parse("2026-09-08T10:15:00Z");
  for (let i = 0; i < 140; i++) {
    const ts = new Date(t0 + i * 1370).toISOString();
    const lvl = i % 23 === 0 ? "WARN" : "INFO";
    const svc = ["gateway", "payments", "ledger", "notify"][i % 4];
    lines.push(`${ts} ${lvl} ${svc} req=req-${(4000 + i).toString(16)} latency_ms=${20 + (i * 7) % 90} status=200 path=/v1/charge`);
    if (i === 97) {
      lines.push(`${ts} ERROR payments req=req-7f3a9c latency_ms=30012 status=500 path=/v1/charge`);
      lines.push(`Traceback (most recent call last):`);
      lines.push(`  File "/app/payments/service.py", line 212, in capture`);
      lines.push(`    result = self.gateway.capture(intent_id, amount_cents)`);
      lines.push(`  File "/app/payments/gateway.py", line 88, in capture`);
      lines.push(`    raise GatewayTimeout(f"stripe capture timed out after {self.timeout}s")`);
      lines.push(`payments.errors.GatewayTimeout: stripe capture timed out after 30s`);
    }
  }
  const instruction = "fix this error, explain root cause in under 5 bullets, i think its the retry config";
  return {
    text: `${instruction}\n\n${lines.join("\n")}`,
    preserve: ["GatewayTimeout", "service.py", "212", "req-7f3a9c", "timed out after 30s", "under 5 bullets", "retry config"],
  };
}

function jsonPaste(): { text: string; preserve: string[] } {
  const results = Array.from({ length: 60 }, (_, i) => ({
    id: `doc-${String(i).padStart(6, "0")}`,
    title: i === 17 ? "Quarterly churn drivers in the SMB segment" : `Report ${i}: weekly metrics digest`,
    score: Math.round((0.97 - i * 0.011) * 1000) / 1000,
    url: `https://kb.example.internal/docs/${i}`,
    updated_at: `2026-0${1 + (i % 8)}-1${i % 9}T08:00:00Z`,
    tags: ["metrics", i % 3 ? "weekly" : "quarterly", i % 5 ? "smb" : "enterprise"],
    metadata: { author: `user${i % 7}@example.com`, words: 1200 + i * 13, lang: "en", version: 1 + (i % 4) },
  }));
  const instruction = "summarize the most relevant of these search results for a non-technical manager, 3 bullets max";
  return {
    text: `${instruction}\n\n${JSON.stringify(results, null, 2)}`,
    preserve: ["summarize", "non-technical manager", "3 bullets", "doc-000017", "Quarterly churn drivers"],
  };
}

function prosePaste(): { text: string; preserve: string[] } {
  const paras = [
    "Autoscaling in Kubernetes is usually introduced as a single feature, but in practice it is three separate control loops that rarely agree with each other. The Horizontal Pod Autoscaler adds or removes replicas based on an observed metric, most often CPU. The Vertical Pod Autoscaler resizes the requests of existing pods. The Cluster Autoscaler adds or removes nodes when pods cannot be scheduled or when nodes sit idle. Each loop has its own polling interval, its own stabilisation window, and its own opinion about what 'enough' means.",
    "Teams that adopt all three at once tend to see oscillation. A burst of traffic raises CPU, the HPA scales out, the new pods cannot be scheduled, the Cluster Autoscaler adds a node, and by the time the node is ready the burst is over. The HPA then scales in, the node drains, and the cycle repeats on the next burst. The fix is not to disable autoscaling but to make the loops slower than the workload they react to, and to scale on a signal closer to the actual work than CPU.",
    "That signal is usually queue depth or requests in flight. KEDA, the Kubernetes Event-Driven Autoscaler, exists to feed exactly those signals into the HPA. Instead of asking 'how hot is the CPU', it asks 'how many messages are waiting in the topic' or 'how many jobs are queued in Redis'. Because the metric leads the load rather than lagging it, the scaler can react before latency degrades, and it can scale to zero when the queue is empty, which CPU-based scaling can never do safely.",
    "The cost side is where this gets interesting for a platform team. In one migration we measured, moving a batch-processing fleet from CPU-based HPA to KEDA-driven scaling on queue depth produced a 37% cost reduction over a quarter, almost entirely from scale-to-zero during off-peak hours. The p95 latency during peak did not change. What did change was the number of on-call pages about 'pods pending', which dropped from roughly twelve per month to two.",
    "None of this removes the need for sensible requests and limits. The VPA can recommend values, and in recommendation-only mode it is safe to run everywhere. In its automatic mode it evicts pods to apply new requests, which interacts badly with the HPA and is the most common source of surprising restarts. Most teams should run VPA as an advisor and apply its numbers by hand in the deployment manifests during a normal release.",
    "The last piece is the stabilisation window. The HPA defaults to five minutes for scale-down and zero for scale-up. For queue-driven workloads that is usually right. For request-driven services behind a load balancer, a longer scale-down window and a small scale-up step avoid the sawtooth pattern that shows up in almost every cluster that turned autoscaling on with the defaults and never revisited them.",
  ];
  const instruction = "summarize in 5 bullets for my team, keep the numbers";
  return {
    text: `${instruction}\n\n${paras.join("\n\n")}`,
    preserve: ["summarize in 5 bullets", "keep the numbers", "KEDA", "37%", "twelve per month to two"],
  };
}

// ---- proxy calls ------------------------------------------------------------
type Msg = Record<string, unknown>;
async function compress(messages: Msg[], config?: Record<string, unknown>) {
  const t = performance.now();
  const res = await fetch(`${BASE}/v1/compress`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, model: MODEL, ...(config ? { config } : {}) }),
    signal: AbortSignal.timeout(60_000),
  });
  const ms = Math.round(performance.now() - t);
  const body = await res.text();
  if (!res.ok) return { ok: false as const, status: res.status, body: body.slice(0, 300), ms };
  return { ok: true as const, ms, data: JSON.parse(body) as {
    messages: Msg[]; tokens_before: number; tokens_after: number; tokens_saved: number;
    compression_ratio: number; transforms_applied: string[]; ccr_hashes: string[];
  } };
}

function textOf(m: Msg): string {
  const c = m.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (p && typeof p === "object" && "text" in p ? String((p as { text: unknown }).text) : "")).join("");
  return "";
}

const asUser = (text: string): Msg[] => [{ role: "user", content: text }];
const asTool = (text: string): Msg[] => {
  const nl = text.indexOf("\n\n");
  const instruction = text.slice(0, nl);
  const payload = text.slice(nl + 2);
  return [
    { role: "user", content: instruction },
    { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "read_file", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call_1", content: payload },
  ];
};

// ---- run --------------------------------------------------------------------
async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.text()).catch((e) => `DOWN: ${(e as Error).message}`);
  console.log(`health: ${health.slice(0, 160)}\n`);

  const pastes = { log: logPaste(), json: jsonPaste(), prose: prosePaste() };
  const variants: { name: string; shape: (t: string) => Msg[]; config?: Record<string, unknown> }[] = [
    { name: "A user-msg, default cfg", shape: asUser },
    { name: "B user-msg, compress_user_messages", shape: asUser, config: { compress_user_messages: true } },
    { name: "C user-msg, +frozen_message_count=0", shape: asUser, config: { compress_user_messages: true, frozen_message_count: 0 } },
    { name: "D as tool-result, default cfg", shape: asTool },
    { name: "E as tool-result, frozen=0", shape: asTool, config: { frozen_message_count: 0 } },
  ];

  const rows: string[] = [];
  const samples: Record<string, string> = {};
  for (const [pname, p] of Object.entries(pastes)) {
    for (const v of variants) {
      const r = await compress(v.shape(p.text), v.config);
      if (!r.ok) { rows.push(`${pname.padEnd(6)} ${v.name.padEnd(40)} HTTP ${r.status} ${r.body.replace(/\s+/g, " ").slice(0, 80)}`); continue; }
      const d = r.data;
      const outText = d.messages.map(textOf).join("\n");
      const lost = p.preserve.filter((s) => !outText.includes(s));
      const saved = d.tokens_before ? Math.round((1 - d.tokens_after / d.tokens_before) * 100) : 0;
      rows.push(
        `${pname.padEnd(6)} ${v.name.padEnd(40)} ${String(d.tokens_before).padStart(6)} → ${String(d.tokens_after).padStart(6)}  saved ${String(saved).padStart(3)}%  ${String(r.ms).padStart(5)}ms  ` +
        `lost=${lost.length ? lost.join("|") : "none"}  transforms=${d.transforms_applied.join(",") || "-"}  ccr=${d.ccr_hashes.length}`,
      );
      if (saved > 0 && !samples[pname]) samples[pname] = outText;
    }
  }
  console.log(["paste  variant".padEnd(47) + " before →  after   saved   latency", ...rows].join("\n"));

  for (const [k, s] of Object.entries(samples)) {
    console.log(`\n--- first compressed output for ${k} (head 900 chars) ---\n${s.slice(0, 900)}\n--- tail 400 ---\n${s.slice(-400)}`);
  }
}
void main();
