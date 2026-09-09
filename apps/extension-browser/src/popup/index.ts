// Popup: model/provider dropdown + the Phase 0 ground-truth signals (§7).
import {
  PROVIDERS,
  EventStore,
  HEADROOM_DEFAULTS,
  isLoopbackUrl,
  type ProviderId,
  type LlmConfig,
  type HeadroomHealth,
} from "@promptforge/core";
import { chromeStore } from "../content/chrome-store.js";
import { getModelConfig, setModelConfig, isConfigUsable } from "../content/model-config.js";
import { getSettings, setSettings, type CompressEngine } from "../content/settings.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const providerSel = $<HTMLSelectElement>("provider");
const modelSel = $<HTMLSelectElement>("model");
const modelCustom = $<HTMLInputElement>("modelCustom");
const apiKey = $<HTMLInputElement>("apiKey");
const keyWrap = $<HTMLDivElement>("keyWrap");
const keyHint = $<HTMLDivElement>("keyHint");
const baseWrap = $<HTMLDivElement>("baseWrap");
const baseUrl = $<HTMLInputElement>("baseUrl");
const saveBtn = $<HTMLButtonElement>("save");
const testBtn = $<HTMLButtonElement>("test");
const statusEl = $<HTMLDivElement>("status");
const cmpEnabled = $<HTMLInputElement>("cmpEnabled");
const cmpEngine = $<HTMLSelectElement>("cmpEngine");
const cmpWrap = $<HTMLDivElement>("cmpWrap");
const hrUrl = $<HTMLInputElement>("hrUrl");
const hrWrap = $<HTMLDivElement>("hrWrap");
const hrTest = $<HTMLButtonElement>("hrTest");
const hrStatus = $<HTMLDivElement>("hrStatus");

const CUSTOM = "__custom__";

function renderProviders(current: ProviderId) {
  providerSel.innerHTML = Object.values(PROVIDERS)
    .map((p) => `<option value="${p.id}"${p.id === current ? " selected" : ""}>${p.label}</option>`)
    .join("");
}

function renderModels(provider: ProviderId, currentModel: string) {
  const spec = PROVIDERS[provider];
  const known = spec.models.some((m) => m.id === currentModel);
  const opts = spec.models
    .map((m) => `<option value="${m.id}"${m.id === currentModel ? " selected" : ""}>${m.label}${m.note ? " — " + m.note : ""}</option>`)
    .join("");
  const customOpt = spec.allowCustomModel
    ? `<option value="${CUSTOM}"${!known && currentModel ? " selected" : ""}>Custom…</option>` : "";
  modelSel.innerHTML = opts + customOpt;
  const useCustom = spec.allowCustomModel && (!known && !!currentModel);
  modelCustom.classList.toggle("hide", !useCustom);
  if (useCustom) modelCustom.value = currentModel;

  keyWrap.classList.toggle("hide", !spec.needsKey);
  keyHint.textContent = spec.keyHint ? `format: ${spec.keyHint}` : "";
  baseWrap.classList.toggle("hide", !spec.editableBaseUrl);
}

function currentConfig(): LlmConfig {
  const provider = providerSel.value as ProviderId;
  const spec = PROVIDERS[provider];
  const model = modelSel.value === CUSTOM ? modelCustom.value.trim() : modelSel.value;
  return {
    provider,
    model,
    apiKey: spec.needsKey ? apiKey.value.trim() || undefined : undefined,
    baseUrl: spec.editableBaseUrl ? baseUrl.value.trim() || spec.baseUrl : spec.baseUrl,
  };
}

async function init() {
  const cfg = await getModelConfig();
  renderProviders(cfg.provider);
  renderModels(cfg.provider, cfg.model);
  if (cfg.apiKey) apiKey.value = cfg.apiKey;
  if (cfg.baseUrl) baseUrl.value = cfg.baseUrl;

  providerSel.addEventListener("change", () => {
    const spec = PROVIDERS[providerSel.value as ProviderId];
    renderModels(providerSel.value as ProviderId, spec.models[0]?.id ?? "");
    baseUrl.value = spec.baseUrl;
    apiKey.value = "";
  });
  modelSel.addEventListener("change", () =>
    modelCustom.classList.toggle("hide", modelSel.value !== CUSTOM));

  saveBtn.addEventListener("click", async () => {
    await setModelConfig(currentConfig());
    saveBtn.textContent = "✓ Saved";
    saveBtn.classList.add("saved");
    setTimeout(() => { saveBtn.textContent = "Save model"; saveBtn.classList.remove("saved"); }, 1400);
    void runTest(); // verify the AI actually connects after saving
  });
  testBtn.addEventListener("click", () => void runTest());

  await renderStats();
  await initCompression();

  // Auto-check connection on open so the user sees status immediately.
  if (isConfigUsable(cfg, PROVIDERS[cfg.provider].needsKey)) void runTest();
}

// ---- Compression of large JSON pastes: built-in by default, Headroom optional ----
async function initCompression() {
  const s = await getSettings();
  cmpEnabled.checked = s.compress;
  cmpEngine.value = s.engine;
  hrUrl.value = s.headroomUrl;
  const sync = () => {
    cmpWrap.classList.toggle("hide", !cmpEnabled.checked);
    hrWrap.classList.toggle("hide", cmpEngine.value !== "headroom");
  };
  sync();

  cmpEnabled.addEventListener("change", async () => {
    sync();
    await setSettings({ compress: cmpEnabled.checked });
  });
  cmpEngine.addEventListener("change", async () => {
    const engine: CompressEngine = cmpEngine.value === "headroom" ? "headroom" : "builtin";
    sync();
    await setSettings({ engine });
    if (engine === "headroom") void checkHeadroom();
  });
  hrUrl.addEventListener("change", async () => {
    const url = hrUrl.value.trim() || HEADROOM_DEFAULTS.baseUrl;
    if (!isLoopbackUrl(url)) {
      setStatusOn(hrStatus, "err", "✕ URL must be http://localhost or http://127.0.0.1 — Headroom runs on this device only.");
      return;
    }
    hrUrl.value = url;
    await setSettings({ headroomUrl: url });
    void checkHeadroom();
  });
  hrTest.addEventListener("click", () => void checkHeadroom());
  if (s.compress && s.engine === "headroom") void checkHeadroom();
}

async function checkHeadroom() {
  setStatusOn(hrStatus, "wait", "⋯ Checking Headroom proxy…");
  const res = await new Promise<HeadroomHealth>((resolve) => {
    chrome.runtime.sendMessage({ type: "pf-headroom-health", url: hrUrl.value.trim() || undefined }, (r) => {
      resolve(chrome.runtime.lastError ? { ok: false, ms: 0, error: chrome.runtime.lastError.message ?? "no response" } : r);
    });
  });
  if (res.ok) {
    setStatusOn(hrStatus, "ok", `● <b>Headroom ${escapeHtml(res.version)}</b> · ${res.ms}ms — large JSON pastes will be compressed`);
  } else {
    setStatusOn(hrStatus, "err", `✕ <b>Not running</b> — ${escapeHtml(res.error)}. Start it with <code>headroom proxy</code>.`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function setStatus(kind: "wait" | "ok" | "err", html: string) {
  setStatusOn(statusEl, kind, html);
}

function setStatusOn(el: HTMLElement, kind: "wait" | "ok" | "err", html: string) {
  el.className = `status show ${kind}`;
  el.innerHTML = html;
}

// Runs the SAME background path as Forge → a pass means Forge will work.
async function runTest() {
  const cfg = currentConfig();
  const spec = PROVIDERS[cfg.provider];
  if (!cfg.model) { setStatus("err", "Pick a model first."); return; }
  if (spec.needsKey && !cfg.apiKey) { setStatus("err", `Enter your ${spec.label} API key.`); return; }
  setStatus("wait", "⋯ Connecting to the AI…");
  const res = await new Promise<{ ok?: boolean; ms?: number; sample?: string; error?: string }>((resolve) => {
    chrome.runtime.sendMessage({ type: "pf-test", cfg }, (r) => {
      resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : r);
    });
  });
  if (res?.ok) {
    setStatus("ok", `● <b>Connected</b> — ${cfg.model.split("/").pop()} · ${res.ms}ms`);
  } else {
    setStatus("err", `✕ <b>Not connected</b> — ${res?.error ?? "unknown error"}`);
  }
}

async function renderStats() {
  const store = new EventStore(chromeStore);
  const events = await store.all();
  const decided = events.filter((e) => e.outcome !== null);
  const accepted = decided.filter((e) => e.outcome === "accepted" || e.outcome === "edited_then_sent").length;
  const rate = decided.length ? Math.round((accepted / decided.length) * 100) : 0;
  const rows: [string, string][] = [
    ["Rewrites", String(events.length)],
    ["Accepted / edited", String(accepted)],
    ["Acceptance rate", `${rate}%`],
    ["G0 target", "≥ 40%"],
  ];
  $("stats").innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join("");
}

void init();
