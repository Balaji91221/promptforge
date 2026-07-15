// Background service worker (MV3). Runs the LLM rewrite here — service-worker
// fetches to hosts in host_permissions BYPASS CORS, so the chosen provider
// (NVIDIA, OpenAI, …) is called directly with NO backend and NO CORS issues.
import { refine, buildLlmCall, testProvider, type LlmConfig } from "@promptforge/core";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[PromptForge] installed — background rewrite ready");
});

type Msg =
  | { type: "pf-rewrite"; input: string; cfg: LlmConfig }
  | { type: "pf-test"; cfg: LlmConfig };

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg?.type === "pf-rewrite") {
    (async () => {
      try {
        const out = await refine(msg.input, buildLlmCall(msg.cfg));
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
  return undefined;
});
