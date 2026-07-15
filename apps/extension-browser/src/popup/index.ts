// Popup: model/provider dropdown + the Phase 0 ground-truth signals (§7).
import { PROVIDERS, EventStore, type ProviderId, type LlmConfig } from "@promptforge/core";
import { chromeStore } from "../content/chrome-store.js";
import { getModelConfig, setModelConfig, isConfigUsable } from "../content/model-config.js";

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

  // Auto-check connection on open so the user sees status immediately.
  if (isConfigUsable(cfg, PROVIDERS[cfg.provider].needsKey)) void runTest();
}

function setStatus(kind: "wait" | "ok" | "err", html: string) {
  statusEl.className = `status show ${kind}`;
  statusEl.innerHTML = html;
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
