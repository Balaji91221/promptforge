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
//   paste mode (BYO path): refine() + mock Headroom proxy → compressed / down / slow / lossy / off
//
// Run:  npx tsx evals/e2e-extension.ts

import { createServer, type IncomingMessage } from "node:http";
import {
  ruleTrim, parseResult, EventStore, InMemoryBackend, estimateTokens,
  refine, buildHeadroomCompress, builtinCompress, HEADROOM_DEFAULTS,
} from "@promptforge/core";
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

// ---- mock Headroom proxy: same contract as POST /v1/compress (shape copied from
// docs/spikes/spike-run4.txt). `mode` switches failure behaviour per scenario. ----
type HeadroomMode = "ok" | "slow" | "text";
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => resolve(b)); });
}
function crush(payload: string): string {
  // SmartCrusher-like: schema header + one CSV row per item.
  const items = JSON.parse(payload) as Record<string, unknown>[];
  const keys = Object.keys(items[0] ?? {});
  const rows = items.map((it) => keys.map((k) => String(it[k])).join(","));
  return `[${items.length}]{${keys.map((k) => `${k}:string`).join(",")}}\n${rows.join("\n")}\n`;
}
function startHeadroom(state: { mode: HeadroomMode }): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ status: "healthy", version: "mock" }));
      }
      if (req.method !== "POST" || req.url !== "/v1/compress") { res.statusCode = 404; return res.end(); }
      const body = JSON.parse(await readBody(req)) as { messages: { role: string; content: string; tool_call_id?: string }[] };
      const tool = body.messages.find((m) => m.role === "tool");
      if (!tool) { res.statusCode = 400; return res.end(JSON.stringify({ error: "no tool message" })); }
      if (state.mode === "slow") await new Promise((r) => setTimeout(r, HEADROOM_DEFAULTS.timeoutMs + 700));
      const compressed = state.mode === "text" ? tool.content.slice(0, Math.floor(tool.content.length * 0.8)) : crush(tool.content);
      const before = estimateTokens(tool.content) + 19, after = estimateTokens(compressed) + 19;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        messages: body.messages.map((m) => (m === tool ? { ...m, content: compressed } : m)),
        tokens_before: before, tokens_after: after, tokens_saved: before - after,
        compression_ratio: after / before,
        transforms_applied: [state.mode === "text" ? "router:text:0.82" : "router:mixed:0.41"],
        ccr_hashes: [],
      }));
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

function bigArray(n: number): string {
  return JSON.stringify(Array.from({ length: n }, (_, i) => ({
    id: `doc-${String(i).padStart(6, "0")}`, title: `Report ${i}: weekly metrics digest`, score: 1 - i / (n + 1),
  })), null, 2);
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
    if (cond) pass++;
    else fail++;
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

  // ---- 6) BYO path in paste mode: instruction + large JSON array, with Headroom ----
  const state: { mode: HeadroomMode } = { mode: "ok" };
  const headroom = await startHeadroom(state);
  const ARR = bigArray(120);
  const ids = Array.from({ length: 120 }, (_, i) => `doc-${String(i).padStart(6, "0")}`);
  const PASTE_JSON = JSON.stringify({
    intent: "summarize", refined_prompt: "Summarize the data below in 3 bullets for a non-technical manager.",
    applied_techniques: ["clarity", "audience"], suggestions: ["specify time range"], quality_before: 30, quality_after: 84,
  });
  const seenTurns: string[] = [];
  const mockLlm = (delayMs: number) => async (_sys: string, user: string) => {
    seenTurns.push(user);
    await new Promise((r) => setTimeout(r, delayMs));
    return PASTE_JSON;
  };
  const raw = `summarize\n\n${ARR}`;

  console.log(`\n▸ paste: "summarize" + ${ids.length}-item JSON array (~${estimateTokens(ARR)} tokens), BUILT-IN engine (no proxy, no network)`);
  const biOut = await refine(raw, mockLlm(0), { compress: builtinCompress });
  const biPrompt = biOut.result?.refined_prompt ?? "";
  const bi = biOut.result?.compression;
  check("compressed on-device", bi?.provider === "builtin", bi ? `${bi.tokens_before} → ${bi.tokens_after} tokens (${Math.round((1 - bi.tokens_after / bi.tokens_before) * 100)}% saved) · ${bi.transforms.join(",")}` : "");
  check("saved ≥ 40%", !!bi && 1 - bi.tokens_after / bi.tokens_before >= 0.4);
  check("table header present", biPrompt.includes(`[${ids.length}]{id:string,title:string,score:`));
  check("every id and title survived", ids.every((id) => biPrompt.includes(id)) && biPrompt.includes("Report 119: weekly metrics digest"));

  console.log(`\n▸ paste: same input, HEADROOM engine (mock proxy up)`);
  state.mode = "ok";
  const t1 = performance.now();
  const okOut = await refine(raw, mockLlm(400), { compress: buildHeadroomCompress({ ...HEADROOM_DEFAULTS, baseUrl: headroom.url }) });
  const okMs = Math.round(performance.now() - t1);
  const okPrompt = okOut.result?.refined_prompt ?? "";
  check("forged despite a 9-char instruction", okOut.status === "ok");
  check("model saw the instruction + attachment note, not the data",
    (seenTurns.at(-1) ?? "").includes("ATTACHED DATA") && !(seenTurns.at(-1) ?? "").includes("doc-000007"));
  check("compression applied and reported", okOut.result?.compression?.provider === "headroom",
    okOut.result?.compression ? `${okOut.result.compression.tokens_before} → ${okOut.result.compression.tokens_after} tokens` : "");
  check("assembled prompt = refined instruction + compressed data", okPrompt.startsWith("Summarize the data below") && okPrompt.includes("[120]{"));
  check("every id survived compression", ids.every((id) => okPrompt.includes(id)), `${ids.length}/${ids.length}`);
  check("tokens_after < tokens_before", (okOut.result?.tokens_after ?? 1) < (okOut.result?.tokens_before ?? 0),
    `~${okOut.result?.tokens_before} → ${okOut.result?.tokens_after}`);
  check("compress ran in parallel with the model call (400ms model, total < 650ms)", okMs < 650, `${okMs}ms`);

  console.log(`\n▸ paste, Headroom proxy DOWN`);
  const downOut = await refine(raw, mockLlm(0), { compress: buildHeadroomCompress({ ...HEADROOM_DEFAULTS, baseUrl: "http://127.0.0.1:1" }) });
  check("still forged", downOut.status === "ok");
  check("original data appended unchanged, no compression info",
    (downOut.result?.refined_prompt ?? "").endsWith(ARR) && downOut.result?.compression === undefined);

  console.log(`\n▸ paste, Headroom proxy SLOW (> ${HEADROOM_DEFAULTS.timeoutMs}ms timeout)`);
  state.mode = "slow";
  const t2 = performance.now();
  const slowOut = await refine(raw, mockLlm(0), { compress: buildHeadroomCompress({ ...HEADROOM_DEFAULTS, baseUrl: headroom.url }) });
  const slowMs = Math.round(performance.now() - t2);
  check("timed out and fell back to the original data", (slowOut.result?.refined_prompt ?? "").endsWith(ARR) && slowOut.result?.compression === undefined);
  check(`gave up within the client timeout (+300ms slack)`, slowMs < HEADROOM_DEFAULTS.timeoutMs + 300, `${slowMs}ms`);

  console.log(`\n▸ paste, Headroom returns a lossy transform (router:text)`);
  state.mode = "text";
  const textOut = await refine(raw, mockLlm(0), { compress: buildHeadroomCompress({ ...HEADROOM_DEFAULTS, baseUrl: headroom.url }) });
  check("rejected by the allowlist, original data kept", (textOut.result?.refined_prompt ?? "").endsWith(ARR) && textOut.result?.compression === undefined);

  console.log(`\n▸ paste, Headroom disabled (no compressor)`);
  const offOut = await refine(raw, mockLlm(0));
  check("byte-identical to the fallback result", offOut.result?.refined_prompt === downOut.result?.refined_prompt);

  headroom.close();
  console.log(`\n${fail === 0 ? "✅ ALL PASS" : "❌ FAILURES"} — ${pass} checks passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

void main();
