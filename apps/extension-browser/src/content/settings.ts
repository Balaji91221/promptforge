// Extension settings (Phase 2). `coach` toggles inline coaching suggestions;
// `mode` picks Auto-refine vs Coach surfacing (§5). Stored locally.
export interface Settings {
  coach: boolean; // show "could still add" suggestions
  autoOpen: boolean; // open overlay on focus vs. on button tap
}

const KEY = "pf_settings";
const DEFAULTS: Settings = { coach: true, autoOpen: false };

export async function getSettings(): Promise<Settings> {
  const out = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(out[KEY] as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
}
