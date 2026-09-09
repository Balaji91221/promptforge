// Extension settings (Phase 2). `coach` toggles inline coaching suggestions;
// `mode` picks Auto-refine vs Coach surfacing (§5). Stored locally.
import { HEADROOM_DEFAULTS } from "@promptforge/core";

/** Which engine compresses large JSON pastes. Built-in needs nothing installed. */
export type CompressEngine = "builtin" | "headroom";

export interface Settings {
  coach: boolean; // show "could still add" suggestions
  autoOpen: boolean; // open overlay on focus vs. on button tap
  /** Compress large JSON pastes on-device before forging. */
  compress: boolean;
  engine: CompressEngine;
  /** Loopback URL of the optional Headroom proxy; non-local URLs are rejected by the popup. */
  headroomUrl: string;
}

const KEY = "pf_settings";
const DEFAULTS: Settings = {
  coach: true,
  autoOpen: false,
  compress: true,
  engine: "builtin",
  headroomUrl: HEADROOM_DEFAULTS.baseUrl,
};

export async function getSettings(): Promise<Settings> {
  const out = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...(out[KEY] as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
}
