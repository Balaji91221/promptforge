# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `apps/mcp`: a stdio MCP server exposing `forge_prompt` to coding agents
  (Claude Code, Codex CLI, Gemini CLI, Cursor, Windsurf). Reuses core
  `refine()` unchanged; provider from `PF_*` env; every failure is a JSON error
  object, the process never exits. `.mcp.json` at the repo root declares it for
  Claude Code. `npm run e2e:mcp` runs a real stdio round-trip against a mock
  model. Live-tested in Claude Code; other agents doc-verified.
  Debt: `apps/mcp/src/config.ts` mirrors `evals/runner.ts` `resolveConfig()`.
- Backend dev server now routes the hosted-mode handlers (`/api/auth`,
  `/api/config`, `/api/events`, `/api/orgs`, `/api/analytics/events`) that the
  dashboard and the extension's sync client already target.
- `npm run deadcode` (knip) with a `knip.json` that knows the extension's
  manifest entry points.
- Launch-ready README (why, install, status table, FAQ, roadmap, screenshots)
  and `docs/LAUNCH.md` with launch and enhancement suggestions.

### Removed

- `ConfigLoader` from `@promptforge/core` and `config/pricing.json`: nothing
  used either. Unused `@promptforge/types` dependency in `adapters` and
  `extension-vscode`.

- Paste mode in `refine()`: an instruction plus a large JSON array is split;
  only the instruction is rewritten, the data is appended by code. Fixes long
  pastes being lost inside the model's 1024-token reply.
- Built-in on-device compressor (`packages/core/src/optimizer/crusher.ts`),
  modelled on Headroom's JSON "crusher": a content router and a JSON-array →
  `[N]{schema}` + CSV encoder. About half the tokens on real arrays, every
  value kept, no install, no network. On by default for qualifying pastes.
- Optional external engine: a local
  [Headroom](https://github.com/headroomlabs-ai/headroom) proxy behind the
  same interface (`optimizer/headroom.ts`). Both engines share one allowlist
  (≥ 25% saved, no lossy route), a 1.5 s timeout, and run in parallel with the
  rewrite call. Popup engine switch + health check, overlay tokens-saved line.
- `npm run e2e:headroom` live check against a real proxy; mock-proxy scenarios
  (up, down, slow, lossy, off) in `npm run e2e`.
- Spike write-up and blueprint under `docs/spikes/` and `docs/`.

- Community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  issue and pull-request templates, Dependabot config.
- ESLint (flat config, `typescript-eslint`) with an `npm run lint` script and
  a CI lint job.
- `apps/backend/tsconfig.json`; every app shell now has a `typecheck` script
  and CI typechecks all of them, not only the engine packages.
- `docs/ARCHITECTURE.md` with the full code tour; package-level READMEs for
  `core`, `adapters`, and `types`.
- `.editorconfig`, `.nvmrc`, `.gitattributes`, `.env.example`.
- Root `package.json` metadata: `repository`, `license`, `engines`, `keywords`.

### Changed

- `PromptHelperResult` gained an optional `compression` field.
- `buildUserTurn()` accepts an attachment note; `META_PROMPT` itself is unchanged
  (no version bump).

- README reorganised: shorter, with a header, badges, and links into `docs/`.
- CI workflow: read-only token permissions, cancel-in-progress concurrency,
  lint and full-typecheck steps.

### Removed

- Unused `compress()` / `CompressCall` exports from `@promptforge/core`
  (replaced by `compressPayload()` / `PayloadCompressor`; zero callers).

## [0.1.0] - 2026-07-15

### Added

- Monorepo: `packages/core` (refine pipeline, providers, parser, tokenizer,
  event store), `packages/adapters` (Claude, ChatGPT, Gemini, Grok,
  Perplexity), `packages/types`.
- Chrome MV3 extension with in-page Forge button, token counter, rewrite
  overlay, and provider/model popup with live connection test.
- Seven model providers behind one `LlmCall` abstraction: NVIDIA NIM, OpenAI,
  Anthropic, Ollama, HuggingFace, OpenRouter, custom OpenAI-compatible.
- CLI shell (PTY wrapper) and VS Code shell (Refine Selection command).
- Next.js dashboard and landing site.
- Optional hosted-mode backend proxy with in-memory reference store.
- Unit tests (Vitest), mock-provider end-to-end harness, meta-prompt eval
  suite, GitHub Actions CI, MIT license.

### Fixed

- Meta-prompt v0.2.0: vague input no longer produces a deflection ("what do
  you need from me?") instead of a directive prompt. Deterministic fallback
  added in `refine()` for models that still deflect.

[Unreleased]: https://github.com/Balaji91221/promptforge/compare/fb68e52...HEAD
[0.1.0]: https://github.com/Balaji91221/promptforge/commits/fb68e52
