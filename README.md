<div align="center">

# ⚒ PromptForge

**The cross-provider prompt-engineering assistant.**

It sits on the input box of every AI chat you use — Claude, ChatGPT, Gemini, Grok, Perplexity — and rewrites your messy input into a clear, well-engineered prompt, coaches you toward better prompting, and tracks your quality trend over time.

[![CI](https://github.com/Balaji91221/promptforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Balaji91221/promptforge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![Node ≥ 22](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](.nvmrc)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.base.json)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](apps/extension-browser)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-14B8A6.svg)](CONTRIBUTING.md)

[Quick start](#quick-start) · [Providers](#model-providers) · [Architecture](#architecture) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

</div>

> Type like you talk → tap **⚒ Forge** → accept, edit, or dismiss. Your words leave the device only when you tap.

## How it works

```
you type            content script          background worker         any LLM provider
"help me fix    →   ⚒ Forge button      →   refine() pipeline     →   NVIDIA · OpenAI ·
 my resume..."      + token counter         pre-clean → LLM call      Anthropic · Ollama ·
                                            → parse → token delta     HuggingFace · custom
                                                    ↓
                    overlay: refined prompt + "what changed" + coach tips
                    → Accept writes it into the chat box
                    → outcome stored locally (acceptance-rate signal)
```

- **Rewrite** — raw input becomes a complete prompt; every constraint preserved, nothing invented.
- **Coach** — inline tips on what's still missing, so you *learn* prompt engineering.
- **Measure** — acceptance rate, edit rate, quality trend. Behavioral truth, not model self-grades.
- **Local-first** — no account, no sync; events and API keys stay in `chrome.storage` on your device.
- **Bring your own model** — seven providers, including a free tier and fully local Ollama.
- **Long pastes stay intact and get smaller** — paste a big JSON array, and only your instruction is rewritten; the data is re-encoded on-device into a compact table (about half the tokens, every value kept). Nothing to install.

## Quick start

Requires **Node.js 22+** (see `.nvmrc`) and a Chromium browser.

```bash
git clone https://github.com/Balaji91221/promptforge.git && cd promptforge
npm install

npm run lint        # ESLint across every workspace
npm run typecheck   # engine packages + every app shell
npm test            # unit tests (Vitest)
npm run e2e         # end-to-end: mock provider → parse → store → G0 signal, no key needed
npm run eval        # meta-prompt eval suite (dry run without a key)
```

### Install the extension

```bash
npm run build:engine
npm run build --workspace apps/extension-browser
```

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `apps/extension-browser/dist`.
2. Open the popup, pick a provider and model (NVIDIA NIM's free `llama-3.1-8b-instruct` is the recommended default), paste your API key, and hit **Save**. The popup verifies the connection live (🟢 *Connected*).
3. Visit claude.ai or any supported chat, type, and tap **⚒ Forge prompt**.

The rewrite runs in the extension's background service worker, which calls the provider directly. No server required.

## Model providers

One engine, seven providers. Pick one in the popup, or add your own OpenAI-compatible endpoint.

| Provider | Recommended model | Key |
|---|---|---|
| **NVIDIA NIM** (free) | `meta/llama-3.1-8b-instruct` | `nvapi-…` |
| OpenAI | `gpt-4o-mini` | `sk-…` |
| Anthropic | `claude-haiku-4-5` | `sk-ant-…` |
| Ollama (local) | `llama3.1:8b` | none |
| HuggingFace | `Llama-3.3-70B-Instruct` | `hf_…` |
| OpenRouter | any OSS model | `sk-or-…` |
| Custom | any OpenAI-compatible | optional |

Run the eval suite against a real model:

```bash
NVIDIA_API_KEY=… npm run eval
PF_PROVIDER=ollama PF_MODEL=llama3.1:8b npm run eval
```

Adding a provider is one entry in `PROVIDERS` in `packages/core/src/prompt-helper/providers.ts`. See [CONTRIBUTING.md](CONTRIBUTING.md#add-a-model-provider).

## Compressing long pastes

Paste a large JSON array (search results, an API response, an export) with an instruction, tap Forge, and PromptForge rewrites only the instruction. The data is re-encoded on-device into a schema header plus CSV rows, the same idea [Headroom](https://github.com/headroomlabs-ai/headroom) uses for tool output, and appended after the refined prompt. Measured on a 500-item array: about half the tokens, 500 of 500 ids kept, under 50 ms, no network.

| Engine | Install | Where it runs | When to pick it |
|---|---|---|---|
| **Built-in** (default) | none | inside the extension | always, unless you already run Headroom |
| Headroom proxy | `pip install "headroom-ai[proxy]"` then `headroom proxy` | a local Python process on `127.0.0.1:8787` | you want Headroom's other routes or its stats dashboard |

Both engines sit behind the same interface and the same guardrails: only JSON arrays with 2+ items and 400+ tokens qualify; a result is used only if it saves 25% or more and did not come from a lossy route; the engine has 1.5 s, in parallel with the rewrite, or the original data is appended unchanged. Turn it off or switch engines in the popup. The measurements behind every rule are in [the spike write-up](docs/spikes/2026-09-09-headroom-compress.md).

## Architecture

One engine, many shells. `packages/core` is a pure TypeScript library that answers *"given messy text and a model config, return a structured rewrite."* The browser extension, CLI, and VS Code shells are three different UIs that ask it that same question.

```
                        ┌─────────────────────────────┐
                        │        packages/core         │   the engine
                        │   (pure TypeScript, no UI)   │   nothing works without this
                        └──────────────┬───────────────┘
                                       │ refine()
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼─────────┐   ┌──────────▼──────────┐   ┌─────────▼─────────┐
    │  extension-browser │   │        cli          │   │  extension-vscode │
    │  (Chrome MV3)      │   │  (PTY wrapper)      │   │  (editor shell)   │
    └────────────────────┘   └─────────────────────┘   └───────────────────┘
```

**Rule of thumb:** a change to *what* a rewrite does (parsing, providers, token counting) belongs in `packages/core`. A change to *where the user sees it* (button, popup, terminal, editor) belongs in the shell.

```
packages/
  core/               the engine: prompt-helper · optimizer · metering · providers · store
  adapters/           per-site DOM adapters (Claude, ChatGPT, Gemini, Grok, Perplexity)
  types/              shared types and output schema
apps/
  extension-browser/  Chrome MV3 shell: content script, service worker, popup (Vite + CRXJS)
  cli/                PTY shim that wraps codex / claude / gemini
  extension-vscode/   VS Code "Refine Selection" command
  backend/            optional hosted-mode proxy + Postgres schema
  dashboard/          Next.js quality-trend dashboard
  landing/            Next.js marketing site
evals/                meta-prompt eval suite + end-to-end harness
config/               versioned selectors and pricing references
docs/                 architecture tour
```

The full code tour, with the rewrite pipeline and the extension's message flow, is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Each engine package has its own README: [core](packages/core/README.md) · [adapters](packages/adapters/README.md) · [types](packages/types/README.md).

## Development

| Command | What it does |
|---|---|
| `npm run lint` | ESLint (flat config, `typescript-eslint`) |
| `npm run typecheck` | `tsc -b` on the engine, then every app shell |
| `npm test` / `npm run test:watch` | Vitest unit tests against source |
| `npm run e2e` | Full pipeline against a mock provider and a mock Headroom proxy |
| `npm run e2e:headroom` | 500-item paste through the built-in engine, plus the Headroom proxy when one is running |
| `npm run eval` | Meta-prompt eval suite; dry run without a key |
| `npm run build:engine` | Compile `types`, `core`, `adapters` to `dist/` |
| `npm run dev:ext` | Vite dev server for the extension |
| `npm run dev --workspace apps/backend` | Optional local hosted-mode proxy on :3000 |
| `npm run dev --workspace apps/landing` | Marketing site on :3000 |
| `npm run clean` | Remove all build output |

Copy `.env.example` to `.env` for the eval suite and the optional proxy. The extension never reads it; configure it in the popup.

Guardrails baked in: opt-in button only · length gate (no LLM call on trivial input) · original always kept, diff always shown · 30s provider timeout · minimal host permissions (never `<all_urls>`) · deflection guard with a deterministic fallback · pasted data never edited or sent to the rewrite model.

The roadmap is phased behind **validation gates**: nothing past the Phase 0 MVP ships until real usage clears a ≥40% rewrite-acceptance rate (the G0 signal shown in the popup).

## Contributing

Contributions are welcome, from a typo fix to a new platform adapter. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and the pull-request checklist. This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

Good first contributions:

- Add a model provider (one catalog entry plus a test).
- Add a chat platform adapter (one file plus selectors).
- Add an eval case in `evals/cases.json` for a rewrite that went wrong.

## Security

Please report vulnerabilities privately through GitHub's **Security → Report a vulnerability** tab, not as a public issue. Details in [SECURITY.md](SECURITY.md).

## Privacy

Local-first by design. The text you're typing is read only from the input box of supported sites and leaves your device only when you explicitly tap Forge — and then only to the model provider *you* configured with *your* key. No accounts, no telemetry, no third-party storage.

## License

[MIT](LICENSE) © Balaji91221
