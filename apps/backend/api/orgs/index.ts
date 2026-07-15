// Teams / orgs (plan §18 Phase 5). Shared dashboards + prompt-quality
// reporting across members. Auth via the same bearer token; SSO/SAML is added
// at the auth layer (Clerk/WorkOS) without changing this route.
import { requireUser } from "../auth/index.js";
import { db } from "../../db/client.js";

export default async function handler(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  // GET /api/orgs → the org-level aggregated quality/usage the admin sees.
  const orgs = await db.orgsForUser?.(user.id);
  return json({ orgs: orgs ?? [] }, 200);
}

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
