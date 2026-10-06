# Blueprint — PromptForge MCP server (Claude Code, Codex, Gemini CLI, Cursor, Windsurf)

**Type:** CREATE · **Date:** 2026-10-06 · **Status:** Built and verified 2026-10-06 (160 unit, 12 MCP e2e green; live-tested in Claude Code headless with a mock model; Codex/Gemini/Cursor/Windsurf configs doc-verified)

| | |
|---|---|
| **What** | A small MCP server (Model Context Protocol: a standard way for AI agents to call external tools) that exposes the existing `refine()` engine as one tool, `forge_prompt`, so every coding agent can rewrite a vague request into a well-engineered prompt. |
| **Effort** | M (1 day): server + tests half a day, agent configs + README half a day |
| **Done when** | `claude mcp add promptforge ...` in this repo, then "forge this: fix my login bug" in Claude Code returns a refined prompt with "what changed" and coach tips, with no crash when the provider key is missing. |

## 1. Needs & Goals

**For whom:** a developer who uses coding agents (Claude Code, Codex CLI, Gemini CLI, Cursor, Windsurf) and types vague requests into them.

| | |
|---|---|
| **Now** | PromptForge works only in web chats via the Chrome extension. The CLI shim in `apps/cli` wraps a terminal in a PTY, is fragile, needs a running backend, and is one integration per tool. |
| **Problem** | None of the five coding agents get a Forge. The PTY path cannot be made reliable across tools. |
| **Adding** | `apps/mcp`: a stdio MCP server with one tool `forge_prompt(input) → { refined_prompt, applied_techniques, suggestions, quality_before, quality_after, tokens }`. Provider comes from env (same `PF_*` variables the eval runner already uses). |
| **After** | One binary, five one-line configs. The user says "forge this: …" or the agent calls the tool itself when a request is vague. The agent shows what changed and proceeds with the refined prompt. |

| Goal | How we know it's met |
|---|---|
| G-1 | `forge_prompt` returns a valid result in Claude Code on this machine (live check, transcript in `docs/spikes/2026-10-06-mcp-live-claude-code.txt`). |
| G-2 | Server starts and lists the tool in under 500 ms; a tool call costs exactly 1 provider call. |
| G-3 | 5 config snippets (Claude Code, Codex, Gemini CLI, Cursor, Windsurf) in README, each verified against the vendor doc with the date noted. |

**UX difference to say out loud:** in the browser the user taps Forge before sending. With MCP the *agent* decides to call the tool. Automatic refine of every prompt needs a hook or a `/forge` skill, which is Phase 2 (out of scope here).

## 2. Scope
| In | Out (for now) |
|---|---|
| `apps/mcp` stdio server, one tool `forge_prompt` | Automatic refine on every prompt (Claude Code `UserPromptSubmit` hook + `/forge` skill) → follow-on plan |
| Provider from env: `PF_PROVIDER / PF_MODEL / PF_API_KEY / PF_BASE_URL`, plus `NVIDIA_API_KEY` / `ANTHROPIC_API_KEY` shortcuts | Acceptance-rate metering (no Accept/Dismiss signal exists in MCP) |
| Clean error object when no provider is configured | HTTP/SSE transport, hosted mode, auth |
| Unit test (mock `LlmCall`) + stdio e2e test | Web adapters for claude.ai/code and chatgpt.com/codex |
| Root `.mcp.json` so the clone itself is the demo for Claude Code | Fixing or removing `apps/cli` PTY shim (Cursor/Windsurf are VS Code forks, `apps/extension-vscode` may already load there — not verified, not in scope) |
| README section with 5 agent configs | Paste-mode compression over MCP (works via core, but not tested here) |

## 3. Entry Criteria — start only when ALL are ticked
- [x] You approve this plan (approved 2026-10-06)
- [x] Node ≥ 22 (check: `node -v` → v26.5.0)
- [x] Engine builds and tests green (check: `npm test` → 148 passed)
- [x] Claude Code installed for the live check (check: `which claude` → `~/.local/bin/claude`)
- [x] No provider key on this machine → live check ran with a local mock model (`docs/spikes/2026-10-06-mcp-live-claude-code.txt`). A real-model run still needs `NVIDIA_API_KEY` or `ANTHROPIC_API_KEY`.
- [x] Codex / Gemini / Cursor / Windsurf are NOT installed here — their configs are doc-verified only, not live-tested. Stated in README.

## 4. Requirements
- R-1 Any MCP-capable agent must be able to call `forge_prompt` over stdio with zero code changes in the agent.
- R-2 The tool must reuse `packages/core` `refine()` unchanged. No second rewrite pipeline.
- R-3 `packages/core` must stay browser-safe: no `process.env`, no Node imports added to it.
- R-4 Missing or wrong provider config must return a readable error from the tool, never crash the server.
- R-5 Prompt text is sent only to the configured provider. The server stores nothing on disk.
- R-6 The tool description must tell the agent to show the user what changed before acting on the refined prompt.

## 5. Functional / Non-functional

> **Functional = WHAT it does.** A feature. "User can log in."
> **Non-functional = HOW WELL it does it.** A measurable quality. "Login answers in under 2 seconds."
> **Quick test:** can you demo it? → Functional. Does it need a number? → Non-functional.

**Functional — what it does**
- FR-1 An agent can list tools and see exactly one: `forge_prompt` with an `input: string` schema.
- FR-2 An agent can call `forge_prompt` and get `refined_prompt`, `applied_techniques`, `suggestions`, `quality_before`, `quality_after`, `tokens_before`, `tokens_after`.
- FR-3 Input shorter than 12 cleaned chars returns `status: "too_short"` with no provider call.
- FR-4 With no provider configured, the call returns `{ error: "no_provider", hint: "set PF_PROVIDER…" }`.
- FR-5 A developer can run `npm run e2e:mcp` and see the stdio round-trip pass with a mock model.
- FR-6 A developer can copy one config block per agent from README and the server starts.

**Non-functional — how well** (each ends with a number)
- NFR-1 Speed: server start to `tools/list` answered in under 500 ms.
- NFR-2 Latency: tool call = 1 provider call, under 3 s with Llama 3.1 8B on NVIDIA NIM; hard timeout 30 s (already in `buildLlmCall`).
- NFR-3 Cost: 1 model call per invocation, about 1,100 input + 300 output tokens; free on NIM, under $0.001 on gpt-4o-mini.
- NFR-4 Security: key read from env only; never logged; never echoed in tool output. Grep for `apiKey` in log lines → 0 hits.
- NFR-5 Reliability: server survives 100 consecutive bad calls (empty input, no key, provider 500) with 0 process exits.
- NFR-6 Observability: `PF_DEBUG=1` prints one stderr line per call: provider, model, ms, status. Stdout stays protocol-only.

## 6. Architecture

| Layer | Choice | Why | Instead of |
|---|---|---|---|
| Language | TypeScript, strict, ESM | matches every other app in the monorepo | — |
| Protocol | `@modelcontextprotocol/sdk` (latest stable), stdio transport | all 5 target agents speak stdio MCP; one binary | hand-rolled JSON-RPC (reinventing), HTTP transport (needs a port and auth) |
| Engine | `@promptforge/core` `refine()` + `buildLlmCall()` | already tested (148), has timeout + deflection guard | copying logic into the server |
| Config | env `PF_*` resolver, copied from `evals/runner.ts` into `apps/mcp/src/config.ts` | core must stay DOM-safe; evals is not a package | moving resolver into core (breaks R-3) |
| Model | whatever `PF_PROVIDER` says; README default NVIDIA NIM `meta/llama-3.1-8b-instruct` | free, about 1 s | — |
| Prompts | `META_PROMPT` from core (unchanged); tool description in `apps/mcp/src/tool-description.md` loaded at build | prompts are code, versioned | inline string |
| Evals | 5 cases in `apps/mcp/src/mcp.test.ts`: normal, too_short, no provider, provider 500, deflection → pass = all 5 green | — | — |
| Guardrails | 12-char gate, 30 s timeout, deflection fallback (core); error object on config miss (new) | — | — |
| Storage | none | R-5 | JSONL log |
| Deploy | `npm run build --workspace apps/mcp`; agents run `node apps/mcp/dist/index.js` | no publish step needed for v1 | npm publish (later) |

```mermaid
flowchart TD
    U[Developer] -->|"forge this: fix my login bug"| A[Coding agent<br/>Claude Code · Codex · Gemini · Cursor · Windsurf]
    A -->|tools/call forge_prompt| S[apps/mcp<br/>stdio MCP server]
    S --> C[config.ts<br/>PF_* env → LlmConfig]
    S --> R[core refine()<br/>trim · gate · meta-prompt · parse]
    C --> L[core buildLlmCall()<br/>30 s timeout]
    R --> L
    L -->|1 request| P[LLM provider<br/>NIM · OpenAI · Anthropic · Ollama …]
    P --> R
    R -->|structured result| S
    S -->|refined_prompt + what changed + tips| A
    A -->|shows diff, proceeds| U
```

**Flow:** 1. Agent starts the server once (stdio). 2. Agent lists tools, sees `forge_prompt`. 3. User asks to forge, or agent decides the request is vague. 4. Server resolves provider from env; if none → error object. 5. `refine()` runs: trim → 12-char gate → one model call → parse → deflection guard → token delta. 6. Result returns as JSON text content. 7. Agent shows "what changed" and continues with the refined prompt.

## 7. Folder Structure
```
apps/mcp/                        # NEW workspace, picked up by root "apps/*"
├── package.json                 # name @promptforge/mcp, bin "promptforge-mcp", build/typecheck scripts (CI needs typecheck)
├── tsconfig.json                # extends ../../tsconfig.base.json, lib ES2022 only (no DOM)
├── README.md                    # 5 agent config snippets + env table + "verified on <date>"
└── src/
    ├── index.ts                 # #!/usr/bin/env node — creates server, registers tool, stdio transport
    ├── config.ts                # PF_* env → LlmConfig | null (copied from evals/runner.ts resolveConfig — debt noted)
    ├── forge-tool.ts            # tool schema (zod) + handler: refine() → result | error object
    ├── tool-description.md      # the prompt the agent reads; tells it to show what changed
    └── mcp.test.ts              # 5 unit cases with mock LlmCall
evals/
└── e2e-mcp.ts                   # spawn dist/index.js over stdio with SDK client, mock provider on localhost, assert shape
.mcp.json                        # NEW at repo root — Claude Code auto-discovers; points at apps/mcp/dist/index.js
```

| File | Action | Change |
|---|---|---|
| `apps/mcp/**` | add | new workspace as above |
| `evals/e2e-mcp.ts` | add | stdio round-trip with mock model |
| `.mcp.json` | add | `{ "mcpServers": { "promptforge": { "command": "node", "args": ["apps/mcp/dist/index.js"], "env": {} } } }` |
| `package.json` (root) | edit | add script `"e2e:mcp": "npm run build:engine && npm run build --workspace apps/mcp && tsx evals/e2e-mcp.ts"` |
| `package-lock.json` | edit | SDK + zod added by `npm install` |
| `.github/workflows/ci.yml` | edit | one line: `npm run e2e:mcp` after `npm run e2e` |
| `README.md` | edit | new section "Coding agents (MCP)" with the 5 config blocks and a link to `apps/mcp/README.md` |
| `CHANGELOG.md` | edit | 0.2.0 entry |
| `apps/cli/package.json` | edit | description: mark PTY shim "legacy — prefer apps/mcp" (no code change) |
| `packages/core/**` | none | unchanged (R-2, R-3) |
| `tsconfig.json` (root) | none | references only packages; apps build via workspace scripts |

## 8. Change Impact
| Depends on it | Could break | Test to run |
|---|---|---|
| Root `npm run build --workspaces` | new workspace fails to compile → whole build red | `npm run build` |
| CI `typecheck --workspaces --if-present` | missing `typecheck` script → silently skipped (not a failure, but a gap) | `npm run typecheck` shows `@promptforge/mcp` line |
| `package-lock.json` | SDK pulls transitive deps; `npm ci` in CI | `npm ci && npm test` |
| Claude Code in this repo | `.mcp.json` with a bad path → tool missing, no crash | `claude mcp list` shows promptforge connected |
| Nothing in core/extension/backend imports the new app | — | `npm test` stays 148 + 5 |

## 9. Phases
| # | Goal | Tasks | Files | Effort | You'll see |
|---|---|---|---|---|---|
| 1 | Thin slice works in Claude Code | scaffold `apps/mcp`; `config.ts`; `forge-tool.ts`; `index.ts`; `.mcp.json`; `npm install @modelcontextprotocol/sdk zod`; build | `apps/mcp/*`, `.mcp.json`, lockfile | S (3 h) | `claude mcp list` → promptforge ✓; "forge this: fix my login bug" → refined prompt + what changed + tips (needs a key; with no key you see the clean `no_provider` error instead) |
| 2 | Proven and guarded | 5 unit cases; `evals/e2e-mcp.ts` with mock provider; `PF_DEBUG` stderr line; 100-bad-calls loop | `mcp.test.ts`, `evals/e2e-mcp.ts`, root `package.json`, `ci.yml` | S (3 h) | `npm test` → 153 passed; `npm run e2e:mcp` → PASS; CI green |
| 3 | Five agents documented | WebFetch each vendor's MCP config doc; write Claude Code / Codex (TOML) / Gemini CLI / Cursor / Windsurf blocks with "verified <date>"; README + CHANGELOG; mark `apps/cli` legacy | `apps/mcp/README.md`, `README.md`, `CHANGELOG.md`, `apps/cli/package.json` | S (2 h) | README table with 5 copy-paste blocks; only Claude Code marked "live-tested on this machine" |

Phase 1 is the whole value. Phases 2–3 make it safe and shareable.

## 10. Risks & Rollback
| Risk | Mitigation |
|---|---|
| Agent never calls the tool unprompted | tool description (R-6) names the trigger ("when the user's request is vague or asks to forge"); Phase 2 follow-on plan adds a `/forge` skill + hook for Claude Code |
| Agent's tool-call timeout is shorter than 30 s (varies by agent) | README recommends Llama 3.1 8B (about 1 s); `PF_DEBUG` shows ms per call |
| Config snippets go stale or differ per agent (Codex is TOML, others JSON, paths differ) | each block carries "verified against <doc URL> on <date>"; Codex/Gemini/Cursor/Windsurf marked "doc-verified, not live-tested here" |
| Key leaks into agent logs | key never printed; `PF_DEBUG` line has no key; test greps output for the key value → 0 hits |
| `evals/runner.ts` and `apps/mcp/src/config.ts` resolver drift | both files carry a comment pointing at each other; debt item in CHANGELOG; extract to `packages/node-config` when a third copy appears |
| Chrome-extension privacy claim ("keys stay in chrome.storage") no longer the only story | README states: over MCP the key lives in the agent's config env; prompt text goes to the configured provider, same as today; server stores nothing |
| `npm install` changes lockfile for everyone | one commit, reviewed; rollback below |

**Rollback:** uncommitted → `git checkout -- . && git clean -fd apps/mcp .mcp.json` · committed → `git revert <sha>` (current base: `aa6bf7a`).
