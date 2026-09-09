# @promptforge/core

The engine. Pure, isomorphic TypeScript with no DOM, no Node-only APIs, and no
`chrome.*`. Every shell (browser extension, CLI, VS Code, backend, eval runner)
imports `refine()` from here and supplies its own network call.

```ts
import { refine, buildLlmCall, defaultConfig } from "@promptforge/core";

const cfg = { ...defaultConfig("nvidia"), apiKey: process.env.NVIDIA_API_KEY };
const out = await refine("make my resume better java 3yrs", buildLlmCall(cfg));

if (out.status === "ok" && out.result) {
  console.log(out.result.refined_prompt);
  console.log(out.result.suggestions); // coach tips
}
```

## Modules

| Path | Purpose |
|---|---|
| `prompt-helper/index.ts` | `refine()`: pre-clean, length gate, one LLM call, parse, token delta, deflection guard |
| `prompt-helper/meta-prompt.ts` | The versioned instruction sent to the model |
| `prompt-helper/parser.ts` | Turns noisy model output into a validated `PromptHelperResult` |
| `prompt-helper/providers.ts` | Provider catalog, `buildLlmCall()`, `testProvider()` |
| `prompt-helper/templates.ts` | Keyword-based intent guess and focus hints, no AI |
| `optimizer/trim.ts` | Deterministic filler removal |
| `optimizer/paste.ts` | Splits an instruction from a pasted JSON array, either order, payload untouched |
| `optimizer/compress.ts` | `detectPaste()`, `compressPayload()`, `assemblePrompt()`; the compressor is injected |
| `optimizer/crusher.ts` | Built-in engine: content router, JSON-array → `[N]{schema}` + CSV rows, `builtinCompress` |
| `optimizer/headroom.ts` | Optional Headroom proxy client and the shared `acceptCompression()` allowlist |
| `metering/tokenizer.ts` | Fast token estimate for the live counter |
| `shared/store.ts` | `EventStore` over a pluggable key-value backend; computes acceptance rate |
| `shared/config-loader.ts` | Versioned remote config with bundled fallback |

## Rules

- Inject I/O. Network goes through `LlmCall` and `PayloadCompressor`, storage through `KeyValueBackend`.
- Everything the model returns is `unknown` until `parseResult` narrows it.
- Changing `META_PROMPT` means bumping `META_PROMPT_VERSION` and beating the
  eval suite in `evals/`. See the root `CONTRIBUTING.md`.

## Tests

```bash
npm test -- packages/core
```
