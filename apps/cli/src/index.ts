#!/usr/bin/env node
// CLI shim (plan §10, §4 Phase 4). Wraps a target CLI (Codex/Gemini/Grok/
// Claude Code) in a PTY and intercepts a submitted line, running it through
// the Prompt Helper before it reaches the tool. Deliberately last + most
// fragile: one integration per tool, degrade gracefully (§17).
//
//   promptforge -- claude
//   promptforge --refine-key='ctrl+r' -- codex
//
// On the refine hotkey, the current input buffer is rewritten in place.
import { refine, ruleTrim, MIN_CHARS_FOR_REWRITE } from "@promptforge/core";
import type * as NodePty from "node-pty";

const API = process.env.PF_API ?? "http://localhost:3000/api/rewrite";

async function backendCall(_system: string, user: string): Promise<string> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // `user` already contains the RAW INPUT block; the backend re-cleans + adds
    // the meta-prompt, so we forward the inner text.
    body: JSON.stringify({ input: user, platform: "cli" }),
  });
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => {
      try {
        const e = JSON.parse(l.slice(5).trim());
        return e?.delta?.type === "text_delta" ? (e.delta.text as string) : "";
      } catch {
        return "";
      }
    })
    .join("") || text;
}

function parseArgs(argv: string[]): { target: string[]; refineKey: string } {
  const sep = argv.indexOf("--");
  const opts = sep >= 0 ? argv.slice(0, sep) : argv;
  const target = sep >= 0 ? argv.slice(sep + 1) : [];
  const keyArg = opts.find((a) => a.startsWith("--refine-key="));
  return { target, refineKey: keyArg?.split("=")[1] ?? "\x12" /* Ctrl-R */ };
}

async function main() {
  const { target, refineKey } = parseArgs(process.argv.slice(2));
  if (target.length === 0) {
    console.error("usage: promptforge [--refine-key=<seq>] -- <cli> [args...]");
    process.exit(2);
  }

  // node-pty is loaded lazily so the package installs even where native builds
  // are unavailable; without it we exit with a clear message (graceful degrade).
  let pty: typeof NodePty;
  try {
    pty = await import("node-pty");
  } catch {
    console.error("PromptForge: node-pty unavailable on this platform; passing through disabled.");
    process.exit(1);
  }

  const child = pty.spawn(target[0]!, target.slice(1), {
    name: "xterm-color",
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });

  let buffer = "";
  child.onData((d) => process.stdout.write(d));

  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.on("data", async (chunk) => {
    const s = chunk.toString();
    if (s === refineKey) {
      if (ruleTrim(buffer).cleaned.length >= MIN_CHARS_FOR_REWRITE) {
        const out = await refine(buffer, backendCall);
        if (out.status === "ok" && out.result) {
          // clear the line and type the refined prompt into the child.
          child.write("\x15"); // Ctrl-U: clear input line
          child.write(out.result.refined_prompt);
          buffer = out.result.refined_prompt;
        }
      }
      return;
    }
    if (s === "\r" || s === "\n") buffer = "";
    else if (s === "\x7f") buffer = buffer.slice(0, -1); // backspace
    else buffer += s;
    child.write(s);
  });

  child.onExit(({ exitCode }) => process.exit(exitCode));
}

void main();
