// Minimal local dev server (plan §6: "a single serverless function"). Serves
// the web-standard handlers over Node's http so the extension can hit
// http://localhost:3000/api/rewrite during development. In production these
// handlers deploy directly to an edge/serverless host — this file is dev-only.
//
//   NVIDIA_API_KEY=nvapi-… npm run dev --workspace apps/backend
//
import { createServer, type IncomingMessage } from "node:http";
import rewrite from "./api/rewrite.js";

const PORT = Number(process.env.PORT ?? 3000);

// Node IncomingMessage → web Request
async function toRequest(req: IncomingMessage): Promise<Request> {
  const url = `http://localhost:${PORT}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await new Promise((resolve) => {
      let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d));
    });
  }
  return new Request(url, { method, headers, body });
}

const routes: Record<string, (r: Request) => Promise<Response>> = {
  "/api/rewrite": rewrite,
};

const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0]!;
  const handler = routes[path];
  if (!handler) { res.writeHead(404).end("not found"); return; }
  try {
    const webRes = await handler(await toRequest(req));
    const headers: Record<string, string> = {};
    webRes.headers.forEach((v, k) => (headers[k] = v));
    res.writeHead(webRes.status, headers);
    res.end(await webRes.text());
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "server_error", detail: (e as Error).message }));
  }
});

server.listen(PORT, () => {
  const hasKey = !!process.env.NVIDIA_API_KEY || !!process.env.PF_API_KEY;
  console.log(`[PromptForge backend] http://localhost:${PORT}/api/rewrite`);
  console.log(`[PromptForge backend] server key: ${hasKey ? "set (hosted mode available)" : "none (extension must send BYO key)"}`);
});
