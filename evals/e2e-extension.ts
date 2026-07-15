// End-to-end test of the BROWSER EXTENSION data flow, using the *real* modules
// the extension ships — only the LLM is mocked (deterministic, no API key).
//
// Chain exercised (mirrors apps/extension-browser/src/content/index.tsx):
//   messy input
//     → [backend contract] POST /rewrite  (ruleTrim + length gate + streamed SSE)
//     → [extension] streamRewrite()  consumes Anthropic-style SSE
//     → [core] parseResult()  → structured PromptHelperResult
//     → [core] token delta + estimateTokens
//     → write to composer (simulated) + EventStore(InMemoryBackend)
//     → record outcome → acceptanceRate() (the G0 signal)
//
// Run:  npx tsx evals/e2e-extension.ts

import { createServer } from "node:http";
import { ruleTrim, parseResult, EventStore, InMemoryBackend, estimateTokens } from "@promptforge/core";
import type { PromptEvent, Outcome } from "@promptforge/types";

const MIN_CHARS = 12;

// ---- deterministic mock "model": returns a valid PromptHelperResult JSON ----
function mockModelJSON(input: string): string {
  const lower = input.toLowerCase();
  const intent = /summar/.test(lower) ? "summarize" : /email/.test(lower) ? "email"
    : /function|code|python/.test(lower) ? "code" : /explain|how /.test(lower) ? "explain" : "other";
  const refined =
    intent === "summarize" ? "Summarize the text below in 5 concise bullet points, preserving key facts. Under 120 words, neutral tone."
    : intent === "explain" ? "Explain the topic below to a curious beginner using one everyday analogy. Avoid jargon. ~150 words."
    : "Rewrite the request below into a clear, complete instruction with explicit output format and success criteria.";
  return JSON.stringify({
    intent,
    refined_prompt: refined,
    applied_techniques: ["clarity", "output format", "success criteria"],
    suggestions: ["specify desired length", "add an example input/output"],
    quality_before: 30,
    quality_after: 82,
  });
}

// ---- mock backend: same contract as apps/backend/api/rewrite.ts, Anthropic SSE ----
function startBackend(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method !== "POST") { res.statusCode = 405; return res.end(); }
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { input } = JSON.parse(body || "{}");
        const { cleaned } = ruleTrim(String(input ?? ""));
        if (cleaned.length < MIN_CHARS) { res.statusCode = 422; return res.end(JSON.stringify({ error: "too_short" })); }

        res.writeHead(200, { "content-type": "text/event-stream" });
        const json = mockModelJSON(cleaned);
        // stream the JSON in small chunks as Anthropic text_delta events
        let i = 0;
        const tick = () => {
          if (i >= json.length) {
            res.write(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`);
            return res.end();
          }
          const piece = json.slice(i, i + 12); i += 12;
          res.write(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: piece } })}\n\n`);
          setTimeout(tick, 8);
        };
        tick();
      });
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ url: `http://localhost:${port}`, close: () => server.close() });
    });
  });
}

// ---- the extension's SSE consumer needs __PF_API__ + browser globals (Node 18+ has fetch/TextDecoder) ----
async function main() {
  const backend = await startBackend();
  (globalThis as Record<string, unknown>).__PF_API__ = backend.url;
  // import AFTER __PF_API__ is set (module reads the global at call time)
  const { streamRewrite } = await import("../apps/extension-browser/src/content/rewrite-client.ts" as string);

  const store = new EventStore(new InMemoryBackend());
  const composer = { text: "" }; // simulated Claude.ai input box

  const scenarios: { input: string; act: Outcome }[] = [
    { input: "summarize this article for me pls its really long and i dont have time", act: "accepted" },
    { input: "explain how https works like im 12", act: "edited_then_sent" },
    { input: "write a python function to dedupe a list", act: "dismissed" }, // real, but user dismisses
    { input: "hi", act: "dismissed" }, // trivial → gated out (no AI call, no event)
  ];

  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, extra = "") => {
    console.log(`${cond ? "  ✓" : "  ✗"} ${name}${extra ? "  " + extra : ""}`);
    cond ? pass++ : fail++;
  };

  for (const s of scenarios) {
    console.log(`\n▸ input: "${s.input}"`);
    const { cleaned } = ruleTrim(s.input);
    if (cleaned.length < MIN_CHARS) {
      check("length gate blocks trivial input (no AI call)", true, "→ button would say 'too short'");
      continue;
    }

    // 1) stream from backend via the REAL extension client
    let streamedText = "";
    let firstChunkAt = 0;
    const t0 = performance.now();
    await new Promise<void>((resolve, reject) => {
      streamRewrite(s.input, {
        onText: (acc: string) => { if (!firstChunkAt) firstChunkAt = performance.now(); streamedText = acc; },
        onDone: () => resolve(),
        onError: (m: string) => reject(new Error(m)),
      });
    });
    check("streamed SSE from backend", streamedText.length > 0, `(${Math.round(firstChunkAt - t0)}ms to first token)`);

    // 2) parse with the REAL core parser
    const result = parseResult(streamedText);
    check("parsed structured result", !!result.refined_prompt);
    check("intent classified", !!result.intent, `→ ${result.intent}`);
    check("techniques + coaching present", result.applied_techniques.length > 0 && result.suggestions.length > 0,
      `(${result.applied_techniques.length} tech, ${result.suggestions.length} tips)`);

    // 3) token delta (metering)
    const before = estimateTokens(s.input), after = estimateTokens(result.refined_prompt);
    check("token metering computed", before > 0 && after > 0, `~${before} → ${after} tokens`);

    // 4) outcome: write to composer (if not dismissed) + record event
    if (s.act !== "dismissed") composer.text = result.refined_prompt;
    const ev: PromptEvent = { id: "e_" + Math.round(firstChunkAt), ts: Date.now(), platform: "claude",
      raw_input: s.input, result, outcome: s.act };
    await store.append(ev);
    check("event stored with ground-truth outcome", true, `→ ${s.act}`);
    if (s.act !== "dismissed") check("refined prompt written to composer", composer.text === result.refined_prompt);
  }

  // 5) G0 signal
  const rate = await store.acceptanceRate();
  console.log(`\n▸ G0 acceptance rate = ${(rate * 100).toFixed(0)}%  (2 accepted/edited of 3 stored decisions; "hi" gated out; target ≥ 40%)`);
  check("acceptance rate computed from stored outcomes", Math.abs(rate - 2 / 3) < 1e-9);

  backend.close();
  console.log(`\n${fail === 0 ? "✅ ALL PASS" : "❌ FAILURES"} — ${pass} checks passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

void main();
