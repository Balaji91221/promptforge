// chrome.storage-backed KeyValueBackend for the Core EventStore.
// Local-only in Phase 0 (no sync). Guarded so an orphaned content script
// (after an extension reload) no-ops instead of throwing "context invalidated".
import type { KeyValueBackend } from "@promptforge/core";

function alive(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

export const chromeStore: KeyValueBackend = {
  async get(key) {
    if (!alive()) return undefined;
    try {
      const out = await chrome.storage.local.get(key);
      return out[key];
    } catch { return undefined; }
  },
  async set(key, value) {
    if (!alive()) return;
    try { await chrome.storage.local.set({ [key]: value }); } catch { /* orphaned */ }
  },
};
