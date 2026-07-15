// Analytics read model (plan §11). Returns the caller's PromptEvents for the
// dashboard to aggregate (see apps/dashboard/lib/analytics.ts). Aggregation
// could move server-side later; Phase 1 keeps it simple.
import { requireUser } from "../auth/index.js";
import { db } from "../../db/client.js";

export default async function handler(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const events = await db.promptEventsForUser(user.id);
  return new Response(JSON.stringify(events), {
    status: 200,
    headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
