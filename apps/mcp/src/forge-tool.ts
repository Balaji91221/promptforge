// The forge_prompt tool: env config → core refine() → structured result.
// Every failure path returns a JSON object; the server process never throws.
import { refine, buildLlmCall, ruleTrim, MIN_CHARS_FOR_REWRITE, ParseError, type LlmCall } from "@promptforge/core";
import type { PromptHelperResult } from "@promptforge/types";
import { resolveConfig, describeConfig } from "./config.js";

export type ForgeOutput =
  | ({ status: "ok" } & PromptHelperResult)
  | { status: "too_short"; cleaned: string }
  | { status: "error"; error: "no_provider" | "bad_config" | "model_failed" | "bad_model_output"; hint: string };

export type ForgeDeps = {
  /** Override the model call (tests). Default: build from env. */
  call?: LlmCall;
  env?: NodeJS.ProcessEnv;
  /** Receives one line per call when PF_DEBUG is set. Never contains the key. */
  log?: (line: string) => void;
};

export async function forgePrompt(input: string, deps: ForgeDeps = {}): Promise<ForgeOutput> {
  const env = deps.env ?? process.env;
  const t0 = performance.now();
  const log = (status: string, label: string) =>
    deps.log?.(`[promptforge-mcp] ${label} ${Math.round(performance.now() - t0)}ms ${status}`);

  // Length gate first: trivial input needs no provider at all.
  const { cleaned } = ruleTrim(input);
  if (cleaned.length < MIN_CHARS_FOR_REWRITE) {
    log("too_short", "-");
    return { status: "too_short", cleaned };
  }

  let call = deps.call;
  let label = "injected";
  if (!call) {
    const r = resolveConfig(env);
    if (r.kind === "missing") { log("no_provider", "-"); return { status: "error", error: "no_provider", hint: r.hint }; }
    if (r.kind === "invalid") { log("bad_config", "-"); return { status: "error", error: "bad_config", hint: r.hint }; }
    call = buildLlmCall(r.cfg);
    label = describeConfig(r.cfg);
  }

  try {
    const out = await refine(input, call);
    if (out.status === "too_short" || !out.result) {
      log("too_short", label);
      return { status: "too_short", cleaned: out.cleaned };
    }
    log("ok", label);
    return { status: "ok", ...out.result };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof ParseError) {
      log("bad_model_output", label);
      return { status: "error", error: "bad_model_output", hint: `model did not return the expected JSON: ${msg}` };
    }
    log("model_failed", label);
    return { status: "error", error: "model_failed", hint: msg };
  }
}
