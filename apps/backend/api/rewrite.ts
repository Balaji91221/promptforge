// Backend rewrite proxy (plan §6, §11). Accepts the caller's chosen provider
// config and runs the rewrite SERVER-SIDE via the shared core engine. Because
// the browser only ever talks to this same-origin backend (which sets CORS),
// cloud providers that reject browser-origin calls (OpenAI, NVIDIA, …) now
// work from the extension. Web-standard Request/Response → runs on any
// edge/serverless host.
//
// Body: { input, provider, model?, apiKey?, baseUrl? }
//   - apiKey in the body = BYO (Phase 0 testers).
//   - omitted apiKey falls back to a server env key (hosted mode):
//       <PROVIDER>_API_KEY  (e.g. NVIDIA_API_KEY)  or  PF_API_KEY.

import { refine, buildLlmCall, PROVIDERS, defaultConfig, type LlmConfig, type ProviderId } from "@promptforge/core";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function envKeyFor(provider: ProviderId): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return env[`${provider.toUpperCase()}_API_KEY`] ?? env.PF_API_KEY;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { input?: string; provider?: string; model?: string; apiKey?: string; baseUrl?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const input = (body.input ?? "").toString();
  const provider = (body.provider ?? "nvidia") as ProviderId;
  const spec = PROVIDERS[provider];
  if (!spec) return json({ error: "unknown_provider", options: Object.keys(PROVIDERS) }, 422);

  const cfg: LlmConfig = {
    provider,
    model: body.model || defaultConfig(provider).model,
    apiKey: body.apiKey || envKeyFor(provider),
    baseUrl: body.baseUrl || spec.baseUrl,
  };
  if (spec.needsKey && !cfg.apiKey) return json({ error: "no_api_key", provider }, 401);

  try {
    const out = await refine(input, buildLlmCall(cfg));
    if (out.status !== "ok" || !out.result) return json({ error: "too_short" }, 422);
    return json(out.result, 200);
  } catch (e) {
    return json({ error: "upstream_error", detail: (e as Error).message }, 502);
  }
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
