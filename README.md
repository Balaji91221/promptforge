# PromptForge

The cross-provider prompt-engineering assistant: rewrite messy input into a
clear, well-engineered prompt, coach the user toward better prompting, and show
token usage / headroom — on top of every AI tool they already use.

This repo implements the full plan (§14 tree), phased. **The shared engine is
built and verified end-to-end; each surface/cloud service is a working scaffold
on top of it.** The discipline of the plan holds: nothing past Phase 0 should
*ship* until the G0 gate (§7) passes — but the code paths are laid down.

## What maps to which phase

| Phase | Deliverable | Where |
|-------|-------------|-------|
| **0** | Validation MVP: one-platform extension, pre-clean → streamed cheap-LLM call → structured output → accept/edit/dismiss, token counter, local-only storage, eval set | `packages/core`, `apps/extension-browser`, `apps/backend/api/rewrite.ts`, `evals/` |
| **1** | All web chats + dashboard + accounts/sync + per-intent templates | `packages/adapters` (5 platforms), `apps/dashboard`, `apps/backend/api/{auth,events,analytics}`, `packages/core/.../templates.ts` |
| **2** | Coach mode + hosted rewrite + deep optimize + Remote Config | `.../settings.ts` + Overlay coach toggle, `apps/backend/api/config`, `packages/core/.../compress.ts`, `.../config-loader.ts` |
| **3** | VS Code extension | `apps/extension-vscode` |
| **4** | CLI shims (Codex/Gemini/Grok/Claude Code) | `apps/cli` |
| **5** | Teams — shared dashboards, quality reporting, SSO | `apps/backend/api/orgs`, `db/schema.sql` (orgs/org_members) |

## Layout (§14)

```
packages/
  types/        shared types + output schema (Appendix B)
  core/         the engine — isomorphic TypeScript, verified
    prompt-helper/  meta-prompt (Appendix A), parser, templates, orchestration
    optimizer/      rule trim (pre-clean) + compression (LLMLingua-style)
    metering/       token estimator
    shared/         local EventStore (ground-truth outcomes) + config loader
  adapters/     Claude · ChatGPT · Gemini · Grok · Perplexity
apps/
  extension-browser/  MV3 + TS + React (Vite + CRXJS) — token counter, overlay, coach
  dashboard/          Next.js — quality trend (inline SVG) + G0/G1 signal tiles
  backend/            serverless fns: rewrite · auth · events · config · analytics · orgs; Postgres schema
  extension-vscode/   status-bar token count + "Refine Selection"
  cli/                PTY shim that refines the input line before send
  landing/            Next.js marketing site — parallax hero, live rewrite demo, self-hosted fonts
evals/          meta-prompt eval set (Appendix C) + runner
config/         versioned selectors + pricing refs (bundled now, remote in Phase 2)
```

## Run it

```bash
npm install                 # links workspaces
npm run eval                # validates the harness (dry without a key)
ANTHROPIC_API_KEY=sk-... npm run eval   # runs the meta-prompt against the suite
npx tsc -b packages/types packages/core packages/adapters   # typecheck the engine

# Backend: deploy apps/backend/api/*.ts to any edge/serverless host (ANTHROPIC_API_KEY set).
# Extension: PF_API=<url> npm run build --workspace apps/extension-browser
#            then load apps/extension-browser/dist as an unpacked extension.
# Dashboard: (cd apps/dashboard && npm install && npm run dev)
```

> App workspaces (extension, dashboard, vscode, cli) pull their own external
> deps (@types/chrome, next, vscode, node-pty) on first `npm install` in each.
> The **engine** — the shared, testable heart — is verified here without them.

## What proves Phase 0 (the G0 gate, §7)

The extension popup and the dashboard both surface only the signals that matter:
**acceptance rate** (target ≥ 40%), rewrites, platforms used, tokens saved — all
behavioral. LLM "quality" scores are labeled *estimated* and are never the truth.

## Guardrails carried through (§9.1, §15, §16, §17)

Opt-in button · length gate (no AI call on trivial input) · always keep the
original + show the diff · stream the rewrite (first token ≤ 1s budget) ·
minimal host permissions, never `<all_urls>` · local-first, text leaves the
device only on an explicit tap · every meta-prompt change is eval-gated.
