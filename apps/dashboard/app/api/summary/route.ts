// JSON summary endpoint (used by the extension popup's "open dashboard" and
// any external tooling). Mirrors the server component's data source.
import { NextResponse } from "next/server";
import { demoSummary, summarize } from "../../../lib/analytics";
import type { PromptEvent } from "@promptforge/types";

export async function GET() {
  const base = process.env.PF_BACKEND;
  if (base) {
    try {
      const res = await fetch(`${base}/analytics/events`, { cache: "no-store" });
      if (res.ok) return NextResponse.json(summarize((await res.json()) as PromptEvent[]));
    } catch {
      /* fall through */
    }
  }
  return NextResponse.json(demoSummary());
}
