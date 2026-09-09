# Contributing to PromptForge

Thanks for your interest. PromptForge is a small, focused codebase and
contributions of every size are welcome: bug reports, docs fixes, new
platform adapters, new model providers, and eval cases.

## Ground rules

- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Open an issue before a large change so we can agree on the approach.
- Keep pull requests focused: one fix or one feature per PR.
- Every change to `packages/core` needs a unit test.
- Every change to the meta-prompt needs to beat the current version on the
  eval suite before it ships (see [Meta-prompt changes](#meta-prompt-changes)).

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 22 or newer (see `.nvmrc`) |
| npm | 10 or newer |
| Chrome / Chromium | any recent, for the extension |

## Getting started

```bash
git clone https://github.com/Balaji91221/promptforge.git
cd promptforge
npm install

npm run lint          # ESLint across every workspace
npm run typecheck     # engine packages + every app shell
npm test              # unit tests (Vitest)
npm run e2e           # full pipeline against a mock provider, no API key
npm run eval          # meta-prompt eval suite (dry run without a key)
```

To load the extension for local testing:

```bash
npm run build:engine
npm run build --workspace apps/extension-browser
```

Then open `chrome://extensions`, enable *Developer mode*, choose *Load unpacked*,
and select `apps/extension-browser/dist`.

## Where things live

| Path | What it is | Change it when… |
|---|---|---|
| `packages/core` | The engine: refine pipeline, providers, parser, tokenizer, store | …the *behaviour* of a rewrite changes |
| `packages/adapters` | Per-site DOM selectors (Claude, ChatGPT, Gemini, Grok, Perplexity) | …a chat site changes its HTML |
| `packages/types` | Shared TypeScript contracts | …the JSON shape between packages changes |
| `apps/extension-browser` | Chrome MV3 shell | …the *surface* changes (button, popup, overlay) |
| `apps/cli`, `apps/extension-vscode` | Terminal and editor shells | …those surfaces change |
| `apps/backend` | Optional hosted-mode proxy | …hosted mode changes |
| `evals/` | Eval cases, eval runner, end-to-end harness | …you add a regression case |

A longer tour is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Common contributions

### Add a model provider

1. Add one entry to `PROVIDERS` in `packages/core/src/prompt-helper/providers.ts`.
   If the host speaks the OpenAI chat-completions protocol, set `wire: "openai"`
   and you are done.
2. Add the API host to `PROVIDER_HOSTS` in `apps/extension-browser/src/manifest.ts`
   so the background worker may call it.
3. Add a test in `providers.test.ts` covering the request shape.
4. Add a row to the providers table in `README.md`.

### Add a chat platform adapter

1. Create `packages/adapters/src/<platform>.ts` exporting a `ProviderAdapter`
   with `hosts` and `webSelectors`.
2. Register it in `packages/adapters/src/index.ts`.
3. Mirror the selectors in `config/selectors.json`.
4. Add a case to `adapters.test.ts` for `adapterForUrl`.

### Meta-prompt changes

The meta-prompt in `packages/core/src/prompt-helper/meta-prompt.ts` is
versioned. To change it:

1. Bump `META_PROMPT_VERSION`.
2. Add at least one eval case in `evals/cases.json` that the old version fails.
3. Run the suite against a real model and paste the before/after pass counts
   in the PR description:

   ```bash
   NVIDIA_API_KEY=… npm run eval
   ```

A change that does not improve the eval pass rate is not merged.

## Coding conventions

- TypeScript `strict` everywhere. No `any`, no non-null `!` outside tests.
- Data crossing a boundary (network, `chrome.storage`, `JSON.parse`) is
  `unknown` until narrowed. See `parser.ts` for the pattern.
- `packages/core` must stay isomorphic: no DOM, no Node-only APIs, no
  `chrome.*`. Inject I/O through the `LlmCall` and `KeyValueBackend`
  interfaces.
- Run `npm run lint` and `npm run typecheck` before pushing. CI runs both.

## Commit messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add Mistral provider
fix(extension): keep Forge button alive after SPA re-render
docs: clarify BYO key flow in README
chore(ci): typecheck every app shell
```

Types in use: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`.

## Pull request checklist

- [ ] Tests added or updated, and `npm test` is green
- [ ] `npm run lint` and `npm run typecheck` are green
- [ ] `CHANGELOG.md` has an entry under **Unreleased**
- [ ] Docs updated if behaviour or setup changed
- [ ] No API keys, tokens, or personal data in the diff

## Release process

1. Move **Unreleased** entries in `CHANGELOG.md` under a new version heading.
2. Bump `version` in `apps/extension-browser/src/manifest.ts` and the root
   `package.json`.
3. Tag: `git tag vX.Y.Z && git push --tags`. CI uploads the built extension
   as a workflow artifact.

## Questions

Open a [discussion or issue](https://github.com/Balaji91221/promptforge/issues).
There are no bad questions.
