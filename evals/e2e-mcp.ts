// End-to-end test of the MCP server over real stdio: spawn dist/index.js,
// list tools, call forge_prompt in 4 states. The model is a local mock
// (OpenAI-compatible) — no key needed.
//
// Run:  npm run e2e:mcp
import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER = "apps/mcp/dist/index.js";
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

function mockModel(): Promise<{ url: string; close: () => void; calls: () => number }> {
  let n = 0;
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
        n++;
        if (req.url?.includes("/fail")) { res.statusCode = 500; return res.end("boom"); }
        const result = JSON.stringify({
          intent: "code", refined_prompt: "Fix the login bug: describe the failing flow, expected vs actual, and share the relevant code. Return a root-cause explanation and a minimal patch.",
          applied_techniques: ["clarity", "output format"], suggestions: ["add the error message"], quality_before: 25, quality_after: 80,
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: result } }] }));
      });
    });
    srv.listen(0, () => {
      const a = srv.address(); const port = typeof a === "object" && a ? a.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => srv.close(), calls: () => n });
    });
  });
}

async function connect(env: Record<string, string>): Promise<Client> {
  const transport = new StdioClientTransport({ command: "node", args: [SERVER], env: { ...process.env as Record<string, string>, ...env }, stderr: "pipe" });
  const client = new Client({ name: "e2e", version: "0" });
  await client.connect(transport);
  return client;
}
type ToolText = { content: { type: string; text?: string }[]; isError?: boolean };
function parse(r: unknown): { out: Record<string, unknown>; isError: boolean } {
  const t = r as ToolText; const text = t.content[0]?.text ?? "{}";
  return { out: JSON.parse(text) as Record<string, unknown>, isError: !!t.isError };
}

// Clean env: strip any real provider keys so the "no provider" case is honest.
const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PF_|NVIDIA_|ANTHROPIC_)/.test(k))) as Record<string, string>;

async function main() {
// 1. no provider configured
{
  const t0 = performance.now();
  const transport = new StdioClientTransport({ command: "node", args: [SERVER], env: clean, stderr: "pipe" });
  const c = new Client({ name: "e2e", version: "0" }); await c.connect(transport);
  const tools = await c.listTools();
  const ms = Math.round(performance.now() - t0);
  check("tools/list has exactly forge_prompt", tools.tools.length === 1 && tools.tools[0]?.name === "forge_prompt", `${ms}ms start→list`);
  check("start→list under 500ms", ms < 500, `${ms}ms`);
  const r = parse(await c.callTool({ name: "forge_prompt", arguments: { input: "fix my login bug it keeps failing" } }));
  check("no provider → error.no_provider, isError", r.out.status === "error" && r.out.error === "no_provider" && r.isError, String(r.out.hint).slice(0, 60));
  const r2 = parse(await c.callTool({ name: "forge_prompt", arguments: { input: "hi" } }));
  check("too_short short-circuits before config (no provider needed)", r2.out.status === "too_short", String(r2.out.status));
  await c.close();
}
// 2. bad provider id
{
  const c = await connect({ ...clean, PF_PROVIDER: "nope" });
  const r = parse(await c.callTool({ name: "forge_prompt", arguments: { input: "fix my login bug it keeps failing" } }));
  check("unknown PF_PROVIDER → error.bad_config", r.out.status === "error" && r.out.error === "bad_config");
  await c.close();
}
// 3. mock provider: ok, too_short, model 500 — and the server survives 100 bad calls
{
  const mock = await mockModel();
  const c = await connect({ ...clean, PF_PROVIDER: "custom", PF_MODEL: "mock-1", PF_BASE_URL: mock.url + "/v1", PF_DEBUG: "1" });
  const t0 = performance.now();
  const r = parse(await c.callTool({ name: "forge_prompt", arguments: { input: "fix my login bug it keeps failing" } }));
  const ms = Math.round(performance.now() - t0);
  check("mock provider → status ok with refined_prompt", r.out.status === "ok" && typeof r.out.refined_prompt === "string" && !r.isError, `${ms}ms`);
  check("result carries applied_techniques + suggestions + quality", Array.isArray(r.out.applied_techniques) && Array.isArray(r.out.suggestions) && typeof r.out.quality_after === "number");
  check("result carries token delta", typeof r.out.tokens_before === "number" && typeof r.out.tokens_after === "number");
  check("exactly 1 model call", mock.calls() === 1, `${mock.calls()} calls`);
  const s = parse(await c.callTool({ name: "forge_prompt", arguments: { input: "hi" } }));
  check("too_short → no model call", s.out.status === "too_short" && mock.calls() === 1);
  await c.close();

  const c2 = await connect({ ...clean, PF_PROVIDER: "custom", PF_MODEL: "mock-1", PF_BASE_URL: mock.url + "/fail" });
  const f = parse(await c2.callTool({ name: "forge_prompt", arguments: { input: "fix my login bug it keeps failing" } }));
  check("provider 500 → error.model_failed", f.out.status === "error" && f.out.error === "model_failed", String(f.out.hint).slice(0, 50));
  let alive = true;
  for (let i = 0; i < 100 && alive; i++) {
    try { await c2.callTool({ name: "forge_prompt", arguments: { input: i % 2 ? "" : "fix my login bug it keeps failing" } }); } catch { alive = false; }
  }
  const still = await c2.listTools().then(() => true).catch(() => false);
  check("server survives 100 bad calls", alive && still);
  await c2.close();
  mock.close();
}
}

main().then(() => {
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}, (e: unknown) => { console.error(e); process.exit(1); });
