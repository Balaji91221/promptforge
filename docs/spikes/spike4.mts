// P4: does SmartCrusher truncate large arrays / long strings? 500 items, one 2,000-char field.
// P5: tool-result shape — is the payload also a quoted, \n-escaped string?
const BASE = "http://127.0.0.1:8787";
type Msg = Record<string, unknown>;
async function compress(messages: Msg[]) {
  const t = performance.now();
  const res = await fetch(`${BASE}/v1/compress`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, model: "gpt-4o" }), signal: AbortSignal.timeout(120_000) });
  const d = await res.json() as { messages: { role: string; content: unknown }[]; tokens_before: number; tokens_after: number; transforms_applied: string[] };
  return { ms: Math.round(performance.now() - t), ...d };
}
const text = (c: unknown) => typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p as { text?: string }).text ?? "").join("") : "";

// deterministic 2,000-char string of pseudo-words
let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const words = ["alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel","india","juliet","kilo","lima"];
let big = ""; while (big.length < 2000) big += words[Math.floor(rnd() * words.length)] + (rnd() < 0.1 ? ". " : " ");
big = big.slice(0, 2000);

const items = Array.from({ length: 500 }, (_, i) => ({
  id: `doc-${String(i).padStart(6, "0")}`, title: `Report ${i}`, score: Math.round((1 - i / 600) * 1000) / 1000,
  tags: ["metrics", i % 2 ? "weekly" : "quarterly"], body: i === 250 ? big : `short body ${i}`,
}));
const payload = JSON.stringify(items, null, 2);
const instruction = "summarize (ticket " + Date.now() + ")";

// P4 user-message shape (cold call right after startup)
const r4 = await compress([{ role: "user", content: `${instruction}\n\n${payload}` }]);
const out4 = r4.messages.map((m) => text(m.content)).join("\n");
const ids = items.filter((it) => out4.includes(it.id)).length;
console.log(`P4 500-item JSON   ${r4.tokens_before} → ${r4.tokens_after}  saved ${Math.round((1 - r4.tokens_after / r4.tokens_before) * 100)}%  ${r4.ms}ms  transforms=${r4.transforms_applied.join(",")}`);
console.log(`   ids kept: ${ids}/500 | 2000-char string intact: ${out4.includes(big)} | longest run of big-string kept: ${(() => { let n = 0; for (let k = 50; k <= 2000; k += 50) if (out4.includes(big.slice(0, k))) n = k; return n; })()} chars`);
console.log(`   'Report 499' present: ${out4.includes("Report 499")} | 'doc-000250' present: ${out4.includes("doc-000250")}`);
// second call, same payload but new nonce → warm latency, no cache
const r4b = await compress([{ role: "user", content: `summarize (ticket ${Date.now() + 1})\n\n${payload}` }]);
console.log(`P4b same, warm     ${r4b.tokens_before} → ${r4b.tokens_after}  ${r4b.ms}ms`);

// P5 tool-result shape
const r5 = await compress([
  { role: "user", content: instruction },
  { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "search", arguments: "{}" } }] },
  { role: "tool", tool_call_id: "call_1", content: payload },
]);
const tool = r5.messages.find((m) => m.role === "tool");
const t5 = text(tool?.content);
console.log(`P5 tool-result     ${r5.tokens_before} → ${r5.tokens_after}  saved ${Math.round((1 - r5.tokens_after / r5.tokens_before) * 100)}%  ${r5.ms}ms  transforms=${r5.transforms_applied.join(",")}`);
console.log(`   tool payload starts with quote? ${t5.startsWith('"')} | literal \\n: ${(t5.match(/\\n/g) ?? []).length} | real newlines: ${(t5.match(/\n/g) ?? []).length} | ids kept: ${items.filter((it) => t5.includes(it.id)).length}/500`);
console.log(`   head: ${JSON.stringify(t5.slice(0, 140))}`);
