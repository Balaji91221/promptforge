// Meta-prompt eval runner (plan Appendix C, §15).
// Every meta-prompt version must pass this before shipping:
//   - all `must_preserve` strings present (case-insensitive)
//   - zero `must_not` violations (heuristic checks)
//   - valid JSON on 100% of cases
//   - intent matches when specified
//
// Usage:
//   ANTHROPIC_API_KEY=sk-... npm run eval
// Without a key it runs in --dry mode and only validates the harness wiring.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { refine, isDeflection, buildLlmCall, PROVIDERS, defaultConfig, type LlmCall, type LlmConfig, type ProviderId } from "@promptforge/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Case {
  id: string;
  raw_input: string;
  language: string;
  category: string;
  must_preserve: string[];
  must_not: string[];
  expect_intent: string;
  expect_techniques_any: string[];
}

// Resolve provider/model/key from env. Friendly shortcuts (NVIDIA_API_KEY,
// ANTHROPIC_API_KEY) or the general PF_PROVIDER/PF_MODEL/PF_API_KEY/PF_BASE_URL.
function resolveConfig(): { call: LlmCall; label: string } | null {
  let cfg: LlmConfig | null = null;
  if (process.env.PF_PROVIDER) {
    const provider = process.env.PF_PROVIDER as ProviderId;
    const spec = PROVIDERS[provider];
    if (!spec) throw new Error(`unknown PF_PROVIDER "${provider}". Options: ${Object.keys(PROVIDERS).join(", ")}`);
    cfg = {
      provider,
      model: process.env.PF_MODEL || spec.models[0]?.id || "",
      apiKey: process.env.PF_API_KEY,
      baseUrl: process.env.PF_BASE_URL || spec.baseUrl,
    };
  } else if (process.env.NVIDIA_API_KEY) {
    cfg = { ...defaultConfig("nvidia"), apiKey: process.env.NVIDIA_API_KEY, model: process.env.NVIDIA_MODEL || defaultConfig("nvidia").model };
  } else if (process.env.ANTHROPIC_API_KEY) {
    cfg = { ...defaultConfig("anthropic"), apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (!cfg) return null;
  return { call: buildLlmCall(cfg), label: `${cfg.provider} · ${cfg.model}` };
}

interface CaseResult {
  id: string;
  category: string;
  ok: boolean;
  failures: string[];
}

function checkCase(c: Case, refined: string, intent: string, techniques: string[]): CaseResult {
  const failures: string[] = [];
  const hay = refined.toLowerCase();

  for (const m of c.must_preserve) {
    if (!hay.includes(m.toLowerCase())) failures.push(`missing must_preserve: "${m}"`);
  }
  if (c.expect_intent && intent !== c.expect_intent) {
    failures.push(`intent ${intent} ≠ expected ${c.expect_intent}`);
  }
  // Heuristic must_not: if the rewrite looks like an answer (very long, no
  // imperative framing) flag the "answering instead of rewriting" cases.
  if (c.must_not.includes("answering instead of rewriting") && c.raw_input.length < 8 && refined.length > 200) {
    failures.push("looks like it answered a trivial input instead of leaving it alone");
  }
  // Deflection: the refined prompt must be a directive, never a message asking
  // the assistant what it needs (the failure mode fixed in meta-prompt v0.2.0).
  if (isDeflection(refined)) {
    failures.push("deflected — asked the assistant for help instead of forging a prompt");
  }

  return { id: c.id, category: c.category, ok: failures.length === 0, failures };
}

async function main() {
  const cases = JSON.parse(readFileSync(join(__dirname, "cases.json"), "utf8")) as Case[];

  const resolved = resolveConfig();
  if (!resolved) {
    console.log(`[eval] DRY RUN — no provider configured. Loaded ${cases.length} cases OK.`);
    console.log("[eval] Set NVIDIA_API_KEY (free), ANTHROPIC_API_KEY, or PF_PROVIDER/PF_MODEL/PF_API_KEY.");
    return;
  }
  const { call } = resolved;
  console.log(`[eval] provider: ${resolved.label}\n`);
  const results: CaseResult[] = [];

  for (const c of cases) {
    try {
      const out = await refine(c.raw_input, call);
      if (out.status === "too_short" || !out.result) {
        // trivial inputs SHOULD short-circuit — pass if no must_preserve.
        results.push({ id: c.id, category: c.category, ok: c.must_preserve.length === 0, failures: c.must_preserve.length ? ["short-circuited but had must_preserve"] : [] });
        continue;
      }
      results.push(checkCase(c, out.result.refined_prompt, out.result.intent, out.result.applied_techniques));
    } catch (e) {
      results.push({ id: c.id, category: c.category, ok: false, failures: [`error: ${(e as Error).message}`] });
    }
  }

  const passed = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.id} [${r.category}]${r.failures.length ? "  " + r.failures.join("; ") : ""}`);
  }
  console.log(`\n[eval] ${passed}/${results.length} passed`);
  if (passed < results.length) process.exitCode = 1;
}

void main();
