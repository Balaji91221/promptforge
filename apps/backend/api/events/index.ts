// Sync ingestion (plan §11 Sync Service). Accepts a PromptEvent from a signed-in
// client and upserts it. Auth is a bearer token (see api/auth). Web-standard
// handler; the `db` calls are abstracted so any Postgres driver plugs in.
import type { PromptEvent } from "@promptforge/types";
import { requireUser } from "../auth/index.js";
import { db } from "../../db/client.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  let e: PromptEvent;
  try {
    e = (await req.json()) as PromptEvent;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!e.id || !e.raw_input) return json({ error: "invalid_event" }, 422);

  await db.upsertPromptEvent(user.id, e);
  return json({ ok: true }, 200);
}

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
