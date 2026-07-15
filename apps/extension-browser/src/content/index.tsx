// Content script (Claude.ai). Injects: (1) a live token counter + Forge button
// anchored near the composer, (2) the rewrite overlay on tap. Reads only the
// input box; text leaves the device only on an explicit tap (§16, §17).

import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { adapterForUrl } from "@promptforge/adapters";
import { EventStore, estimateTokens, PROVIDERS } from "@promptforge/core";
import type { Outcome, PromptEvent, PromptHelperResult } from "@promptforge/types";
import { Overlay } from "./Overlay.js";
import { chromeStore } from "./chrome-store.js";
import { syncEvent } from "./sync-client.js";
import { getSettings } from "./settings.js";
import { getModelConfig, isConfigUsable } from "./model-config.js";

// Ask the background service worker to run the rewrite (CORS-free provider call).
function rewriteViaWorker(input: string, cfg: unknown): Promise<PromptHelperResult> {
  return new Promise((resolve, reject) => {
    if (!extAlive()) return reject(new Error("Extension was reloaded — refresh this page."));
    try {
      chrome.runtime.sendMessage({ type: "pf-rewrite", input, cfg }, (resp) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!resp || resp.error) return reject(new Error(resp?.error ?? "no response"));
        resolve(resp.result as PromptHelperResult);
      });
    } catch (e) {
      reject(new Error((e as Error).message));
    }
  });
}

const store = new EventStore(chromeStore);

// True only while this content script's extension context is still alive.
// After the extension is reloaded/updated, orphaned scripts in open tabs must
// stop touching chrome.* (which throws "Extension context invalidated").
function extAlive(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

// Pick the adapter for whichever supported site we're on (Phase 1: all chats).
const adapter = adapterForUrl(location.href);
const sel = adapter?.webSelectors ?? { input: "textarea", sendButton: "button" };
const PLATFORM = adapter?.id ?? "unknown";

function readInput(el: Element): string {
  const t = el as HTMLTextAreaElement & HTMLElement;
  return (t.value ?? t.innerText ?? t.textContent ?? "").toString();
}

// Find the composer: adapter selector first, then the focused editable, then any
// visible contenteditable/textarea on the page. Robust to SPA/selector drift.
function getInputEl(): Element | null {
  const bySelector = document.querySelector(sel.input);
  if (bySelector) return bySelector;
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.isContentEditable || active.tagName === "TEXTAREA")) return active;
  const candidates = document.querySelectorAll<HTMLElement>('div[contenteditable="true"], textarea');
  for (const c of candidates) if (c.offsetParent !== null) return c; // first visible
  return null;
}

function newId(): string {
  return "pe_" + performance.now().toString(36) + "_" + (globalThis.crypto?.randomUUID?.() ?? "");
}

// ---- Injected controls -----------------------------------------------------
let bar: HTMLDivElement | null = null;
let counter: HTMLSpanElement | null = null;
let overlayHost: HTMLDivElement | null = null;
let overlayRoot: Root | null = null;

function ensureBar() {
  // Re-inject if never created OR if the SPA re-rendered <body> and removed it.
  if (bar && document.body.contains(bar)) return;
  bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "fixed", right: "20px", bottom: "20px", zIndex: "2147483646",
    display: "flex", gap: "8px", alignItems: "center", fontFamily: "system-ui, sans-serif",
  } as CSSStyleDeclaration);

  counter = document.createElement("span");
  Object.assign(counter.style, {
    background: "#0E1622", color: "#8595A5", border: "1px solid #233042",
    borderRadius: "999px", padding: "4px 10px", fontSize: "12px",
  } as CSSStyleDeclaration);
  counter.textContent = "0 tokens";

  const btn = document.createElement("button");
  btn.textContent = "⚒ Forge prompt";
  Object.assign(btn.style, {
    background: "#14B8A6", color: "#06231F", border: "none", borderRadius: "999px",
    padding: "6px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer",
    boxShadow: "0 6px 18px -6px rgba(20,184,166,.6)",
  } as CSSStyleDeclaration);
  btn.addEventListener("click", onForge);

  bar.append(counter, btn);
  document.body.appendChild(bar);
}

function updateCounter() {
  const el = getInputEl();
  if (counter) counter.textContent = `${el ? estimateTokens(readInput(el)) : 0} tokens`;
}

function onForge() {
  console.log("[PromptForge] Forge clicked");
  if (!extAlive()) { flash("Extension was reloaded — refresh this page (⌘⇧R)."); return; }
  const el = getInputEl();
  if (!el) { flash("Click into the chat box first."); return; }
  const raw = readInput(el).trim();
  if (raw.length < 12) {
    flash("Too short to forge — keep typing.");
    return;
  }
  flash("⚒ Forging…"); // instant feedback that the click registered
  openOverlay(raw, el).catch((e) => flash("Error: " + (e as Error).message));
}

async function openOverlay(raw: string, inputEl: Element) {
  closeOverlay();
  overlayHost = document.createElement("div");
  document.body.appendChild(overlayHost);
  overlayRoot = createRoot(overlayHost);

  const id = newId();
  const settings = await getSettings();

  // Rewrite runs in the background service worker, which calls the chosen
  // provider directly (host_permissions bypass CORS) — no backend required.
  const cfg = await getModelConfig();
  const usable = isConfigUsable(cfg, PROVIDERS[cfg.provider].needsKey);
  const refineFn = usable
    ? (input: string): Promise<PromptHelperResult> => rewriteViaWorker(input, cfg)
    : undefined;

  const onOutcome = async (outcome: Outcome, result: PromptHelperResult) => {
    if (outcome !== "dismissed") writeToComposer(inputEl, result.refined_prompt);
    const event: PromptEvent = {
      id, ts: Date.now(), platform: PLATFORM, raw_input: raw, result, outcome,
    };
    await store.append(event);
    void syncEvent(event); // Phase 1+: pushes to cloud when signed in; no-op otherwise
    closeOverlay();
    updateCounter();
  };

  overlayRoot.render(
    createElement(Overlay, { rawInput: raw, coach: settings.coach, refineFn, onOutcome, onClose: closeOverlay }),
  );
}

function closeOverlay() {
  overlayRoot?.unmount();
  overlayHost?.remove();
  overlayRoot = null;
  overlayHost = null;
}

function writeToComposer(el: Element, text: string) {
  const target = el as HTMLElement;
  target.focus();
  // ProseMirror contenteditable: replace text content.
  if (target.isContentEditable) {
    target.textContent = text;
    target.dispatchEvent(new InputEvent("input", { bubbles: true }));
  } else {
    (target as HTMLTextAreaElement).value = text;
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function flash(msg: string) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed", right: "20px", bottom: "64px", zIndex: "2147483647",
    background: "#11161B", color: "#B9C4CE", border: "1px solid #26313B",
    borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontFamily: "system-ui, sans-serif",
  } as CSSStyleDeclaration);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// ---- Boot ------------------------------------------------------------------
function boot() {
  console.log("[PromptForge] content script loaded on", location.host, "· adapter:", PLATFORM);
  if (!adapter) { console.warn("[PromptForge] no adapter for this host — not injecting"); return; }
  ensureBar();
  // Update the counter on any typing (not just an exact selector match).
  document.addEventListener("input", updateCounter, { capture: true });
  document.addEventListener("keyup", updateCounter, { capture: true });
  // Safety net: the SPA can wipe our node or swap the composer — keep the bar
  // alive and the counter fresh regardless of how Claude re-renders.
  const iv = setInterval(() => {
    if (!extAlive()) { clearInterval(iv); bar?.remove(); return; } // orphaned after reload → go quiet
    ensureBar();
    updateCounter();
  }, 1500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
