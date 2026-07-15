// Sync client (plan §9.4, Phase 1+). Pushes PromptEvents to the cloud when the
// user is signed in; a silent no-op otherwise so Phase 0 behavior is unchanged.
// Offline-first: failures are swallowed — the local store is the source of truth
// and a background flush (Phase 2) reconciles.
import type { PromptEvent } from "@promptforge/types";

const SYNC_API = (globalThis as { __PF_SYNC__?: string }).__PF_SYNC__ ?? "";

async function getToken(): Promise<string | null> {
  const { pf_token } = await chrome.storage.local.get("pf_token");
  return (pf_token as string) ?? null;
}

export async function syncEvent(event: PromptEvent): Promise<void> {
  if (!SYNC_API) return;
  const token = await getToken();
  if (!token) return; // not signed in — stay local-only
  try {
    await fetch(`${SYNC_API}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(event),
    });
  } catch {
    /* offline — local store keeps it; Phase 2 flush reconciles */
  }
}
