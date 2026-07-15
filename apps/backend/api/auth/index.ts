// Auth (plan §11). Phase 1: minimal email magic-link → signed session token.
// Phase 5: swap in Clerk/WorkOS for SSO/SAML without changing call sites.
// This module exposes the two things the rest of the backend needs:
//   - a POST handler to start/complete sign-in
//   - requireUser(req) used by protected routes.
import { db } from "../../db/client.js";

export interface AuthedUser {
  id: string;
  email: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Verify a bearer token → user. Returns null if missing/invalid. */
export async function requireUser(req: Request): Promise<AuthedUser | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  return db.userForToken(token);
}

// POST /api/auth  { email }  → issues a token (Phase 1 stub: no email step yet).
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body.email) return json({ error: "email_required" }, 422);

  const { user, token } = await db.signIn(body.email);
  return json({ token, user }, 200);
}

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
