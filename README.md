# ⚒ PromptForge

**The cross-provider prompt-engineering assistant.** It sits on the input box of every AI chat you use — Claude, ChatGPT, Gemini, Grok, Perplexity — and rewrites your messy input into a clear, well-engineered prompt, coaches you toward better prompting, and tracks your quality trend over time.

[![CI](https://github.com/Balaji91221/promptforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Balaji91221/promptforge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)

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

## Quick start

```bash
git clone https://github.com/Balaji91221/promptforge && cd promptforge
npm install

npm test          # 54 unit tests (engine)
npm run e2e       # end-to-end: mock provider → stream → parse → store → G0 signal
npm run eval      # meta-prompt eval suite (dry without a key)

# build the extension
npx tsc -b packages/types packages/core packages/adapters
npm run build --workspace apps/extension-browser
```

**Install the extension:** `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select `apps/extension-browser/dist`. Then open the popup, pick a provider + model (NVIDIA NIM's free `llama-3.1-8b-instruct` is the recommended default), paste your API key, hit **Save** — the popup verifies the connection live (🟢 *Connected*). Visit claude.ai (or any supported chat), type, and tap **⚒ Forge prompt**.

The rewrite runs in the extension's background service worker, which calls the provider directly — no server required.

## Model providers

One engine, seven providers — pick in the popup, or add your own OpenAI-compatible endpoint:

| Provider | Recommended model | Key |
|---|---|---|
| **NVIDIA NIM** (free) | `meta/llama-3.1-8b-instruct` | `nvapi-…` |
| OpenAI | `gpt-4o-mini` | `sk-…` |
| Anthropic | `claude-haiku-4-5` | `sk-ant-…` |
| Ollama (local) | `llama3.1:8b` | none |
| HuggingFace | `Llama-3.3-70B-Instruct` | `hf_…` |
| OpenRouter | any OSS model | `sk-or-…` |
| Custom | any OpenAI-compatible | optional |

Run the eval suite against a real model: `NVIDIA_API_KEY=… npm run eval` (or `PF_PROVIDER=ollama PF_MODEL=llama3.1:8b npm run eval`).

## Repository layout

```
packages/
  core/        the engine (isomorphic TS): prompt-helper · optimizer · metering · providers · store
  adapters/    per-platform DOM adapters (Claude, ChatGPT, Gemini, Grok, Perplexity)
  types/       shared types + output schema
apps/
  extension-browser/  MV3 shell — content script, worker, popup (Vite + CRXJS)
  dashboard/          Next.js — quality trend + usage signals
  landing/            Next.js marketing site
  backend/            optional hosted-mode proxy + Postgres schema (Phase 1+)
  extension-vscode/   VS Code shell (Phase 3)
  cli/                PTY shim for CLI tools (Phase 4)
evals/         meta-prompt eval suite + e2e harness
config/        versioned selectors & pricing references
```

The build is phased behind **validation gates**: nothing past the Phase 0 MVP ships until real usage clears a ≥40% rewrite-acceptance rate (the G0 signal shown in the popup). See the plan document for the full roadmap.

## Development

```bash
npm test                                   # unit tests (Vitest)
npm run e2e                                # full-pipeline test, no key needed
npm run clean                              # remove all build output
npm run dev --workspace apps/backend       # optional local hosted-mode proxy
npm run dev --workspace apps/landing       # marketing site on :3000
```

Guardrails baked in: opt-in button only · length gate (no LLM call on trivial input) · original always kept, diff always shown · 30s provider timeout · minimal host permissions (never `<all_urls>`).

## Privacy

Local-first by design. The text you're typing is read only from the input box of supported sites and leaves your device only when you explicitly tap Forge — and then only to the model provider *you* configured with *your* key. No accounts, no telemetry, no third-party storage.

## License

[MIT](LICENSE) © Balaji91221
