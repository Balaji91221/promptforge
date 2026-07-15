// Remote Config Service (plan §11 — "the survival mechanism", Phase 2).
// Serves the active versioned config (selectors, limits, pricing refs,
// meta-prompts, templates) so platform/prompt changes ship WITHOUT an
// extension release. CDN- and client-cached; clients keep the newer version.
import { db } from "../../db/client.js";

const CACHE = "public, max-age=300, stale-while-revalidate=86400";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }
  const config = await db.activeConfig();
  return new Response(JSON.stringify(config), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": CACHE,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
