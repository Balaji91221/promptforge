// Background service worker (MV3). Runs the LLM rewrite here — service-worker
// fetches to hosts in host_permissions BYPASS CORS, so the chosen provider
// (NVIDIA, OpenAI, …) is called directly with NO backend and NO CORS issues.
// The optional Headroom compressor is reached the same way (loopback host).
import {
  refine,
  buildLlmCall,
  testProvider,
  buildHeadroomCompress,
  builtinCompress,
  headroomHealth,
  isLoopbackUrl,
  HEADROOM_DEFAULTS,
  type LlmConfig,
  type RefineOptions,
  type HeadroomHealth,
} from "@promptforge/core";
import { getSettings } from "../content/settings.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[PromptForge] installed — background rewrite ready");
});

type Msg =
  | { type: "pf-rewrite"; input: string; cfg: LlmConfig }
  | { type: "pf-test"; cfg: LlmConfig }
  | { type: "pf-headroom-health"; url?: string };

/** Paste-mode compressor. Built-in by default (no install); the Headroom proxy
 *  only when chosen AND its URL is loopback. Off when the user turned it off. */
async function refineOptions(): Promise<RefineOptions> {
  const s = await getSettings();
  if (!s.compress) return {};
  if (s.engine === "headroom" && isLoopbackUrl(s.headroomUrl)) {
    return { compress: buildHeadroomCompress({ ...HEADROOM_DEFAULTS, baseUrl: s.headroomUrl }) };
  }
  return { compress: builtinCompress };
}

async function checkHeadroom(url?: string): Promise<HeadroomHealth> {
  const baseUrl = url ?? (await getSettings()).headroomUrl;
  if (!isLoopbackUrl(baseUrl)) {
    return { ok: false, ms: 0, error: "URL must be http://localhost or http://127.0.0.1" };
  }
  return headroomHealth({ ...HEADROOM_DEFAULTS, baseUrl });
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg?.type === "pf-rewrite") {
    (async () => {
      try {
        const out = await refine(msg.input, buildLlmCall(msg.cfg), await refineOptions());
        if (out.status !== "ok" || !out.result) { sendResponse({ error: "input too short to refine" }); return; }
        sendResponse({ result: out.result });
      } catch (e) { sendResponse({ error: (e as Error).message }); }
    })();
    return true;
  }
  if (msg?.type === "pf-test") {
    (async () => sendResponse(await testProvider(msg.cfg)))();
    return true;
  }
  if (msg?.type === "pf-headroom-health") {
    (async () => sendResponse(await checkHeadroom(msg.url)))();
    return true;
  }
  return undefined;
});
