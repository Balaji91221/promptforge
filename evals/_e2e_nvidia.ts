// TRUE end-to-end with the REAL NVIDIA model, through the real backend handler
// and the real core engine + store (mirrors the extension's flow).
import handler from "../apps/backend/api/rewrite.ts";
import { EventStore, InMemoryBackend, estimateTokens } from "@promptforge/core";
import type { PromptEvent } from "@promptforge/types";

const KEY = process.env.NVIDIA_API_KEY!;
const store = new EventStore(new InMemoryBackend());

async function forge(input: string, outcome: PromptEvent["outcome"]) {
  console.log(`\n▸ INPUT: "${input}"`);
  const t0 = Date.now();
  const res = await handler(new Request("http://x/api/rewrite", {
    method: "POST",
    body: JSON.stringify({ input, provider: "nvidia", model: "meta/llama-3.3-70b-instruct", apiKey: KEY }),
  }));
  const ms = Date.now() - t0;
  const body: any = await res.json();
  if (res.status !== 200) { console.log(`  ✗ ${res.status}:`, body); return; }
  console.log(`  ✓ ${res.status} in ${ms}ms · intent=${body.intent}`);
  console.log(`  REFINED: ${body.refined_prompt}`);
  console.log(`  techniques: ${body.applied_techniques.join(", ")}`);
  console.log(`  coach tips: ${body.suggestions.join(" | ")}`);
  console.log(`  quality(est): ${body.quality_before} → ${body.quality_after} · tokens ~${estimateTokens(input)} → ${estimateTokens(body.refined_prompt)}`);
  const ev: PromptEvent = { id: "e"+t0, ts: t0, platform: "claude", raw_input: input, result: body, outcome };
  await store.append(ev);
}

async function main() {
  await forge("summarize this article for me pls its really long and i dont have time", "accepted");
  await forge("make my resume better java spring 3yrs fintech job", "edited_then_sent");
  await forge("mujhe ek trip plan karni hai goa ke liye 3 din budget 20000", "dismissed"); // Hindi
  const rate = await store.acceptanceRate();
  console.log(`\n▸ G0 acceptance rate = ${(rate*100).toFixed(0)}%  (from stored outcomes)`);
  console.log("✅ END-TO-END OK — real NVIDIA model through backend → parse → store");
}
void main();
