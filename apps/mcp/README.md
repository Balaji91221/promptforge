# @promptforge/mcp

PromptForge for coding agents. A stdio [MCP](https://modelcontextprotocol.io) server
(Model Context Protocol: a standard way for AI agents to call external tools) that exposes
one tool, `forge_prompt`, built on the same `refine()` engine as the Chrome extension.

```
you: "forge this: fix my login bug"
agent → forge_prompt → PromptForge → your model → refined prompt + what changed + tips
agent shows the diff, then works from the refined prompt
```

The agent decides when to call the tool: when you say "forge" / "improve my prompt", or when
your request is vague. It does not rewrite every prompt automatically (that needs a hook or a
`/forge` skill; see the roadmap in `docs/PLAN-create-mcp-server.md`).

## Build

```bash
npm install
npm run build:engine
npm run build --workspace apps/mcp        # → apps/mcp/dist/index.js
```

## Configure a model

The server reads its provider from environment variables set in the agent's MCP config.
Same providers as the extension popup.

| Variable | Example | Notes |
|---|---|---|
| `PF_PROVIDER` | `nvidia` · `openai` · `anthropic` · `ollama` · `huggingface` · `openrouter` · `custom` | required unless a shortcut below is set |
| `PF_MODEL` | `meta/llama-3.1-8b-instruct` | defaults to the provider's first model |
| `PF_API_KEY` | `nvapi-…` | required for every provider except `ollama` / `custom` |
| `PF_BASE_URL` | `http://localhost:11434/v1` | only for `ollama` / `custom` |
| `NVIDIA_API_KEY` | `nvapi-…` | shortcut: provider `nvidia`, free tier |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | shortcut: provider `anthropic` |
| `PF_DEBUG` | `1` | one stderr line per call: provider · model · ms · status. Never the key. |

Recommended: NVIDIA NIM `meta/llama-3.1-8b-instruct` (free, about 1 s). Some agents time
out tool calls before the server's 30 s limit, so prefer a fast model.

## Add to your agent

`<REPO>` is the absolute path of this clone. All five run the same command:
`node <REPO>/apps/mcp/dist/index.js`. Config formats verified against each vendor's docs on
2026-10-06. Only Claude Code was live-tested on a real machine; the others are doc-verified.

### Claude Code — live-tested

Inside this repo the server is already declared in `.mcp.json`; run `claude` once and approve it.
From any other project:

```bash
claude mcp add --scope user --env NVIDIA_API_KEY=nvapi-… --transport stdio promptforge -- node <REPO>/apps/mcp/dist/index.js
```

Or by hand. `.mcp.json` is project scope and gets committed, so never put a literal key in it;
Claude Code expands `${VAR}` from your shell:

```json
{
  "mcpServers": {
    "promptforge": {
      "command": "node",
      "args": ["<REPO>/apps/mcp/dist/index.js"],
      "env": { "NVIDIA_API_KEY": "${NVIDIA_API_KEY:-}" }
    }
  }
}
```

The repo's own `.mcp.json` does exactly this: export `NVIDIA_API_KEY` (or the `PF_*` set) in
your shell, build, run `claude` in the repo, approve the server. Note `dist/` is gitignored, so a
fresh clone must build before the server can start.

Check: `claude mcp list` shows `promptforge … ✔ Connected`. Then: `forge this: fix my login bug`.

### Codex CLI — doc-verified

```bash
codex mcp add promptforge --env NVIDIA_API_KEY=nvapi-… -- node <REPO>/apps/mcp/dist/index.js
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.promptforge]
command = "node"
args = ["<REPO>/apps/mcp/dist/index.js"]
env = { NVIDIA_API_KEY = "nvapi-…" }
```

### Gemini CLI — doc-verified

```bash
gemini mcp add -s user -e NVIDIA_API_KEY=nvapi-… promptforge node <REPO>/apps/mcp/dist/index.js
```

Or in `~/.gemini/settings.json` (user) / `.gemini/settings.json` (project):

```json
{
  "mcpServers": {
    "promptforge": {
      "command": "node",
      "args": ["<REPO>/apps/mcp/dist/index.js"],
      "env": { "NVIDIA_API_KEY": "nvapi-…" }
    }
  }
}
```

### Cursor — doc-verified

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "promptforge": {
      "command": "node",
      "args": ["<REPO>/apps/mcp/dist/index.js"],
      "env": { "NVIDIA_API_KEY": "nvapi-…" }
    }
  }
}
```

### Windsurf (Cascade) — doc-verified

The docs now live under docs.devin.ai and give `~/.config/devin/mcp_config.json`
(older installs: `~/.codeium/windsurf/mcp_config.json`). Same JSON shape as Cursor.

```json
{
  "mcpServers": {
    "promptforge": {
      "command": "node",
      "args": ["<REPO>/apps/mcp/dist/index.js"],
      "env": { "NVIDIA_API_KEY": "nvapi-…" }
    }
  }
}
```

## The tool

`forge_prompt(input: string)` → JSON text:

| Field | Meaning |
|---|---|
| `status` | `ok` · `too_short` · `error` |
| `refined_prompt` | the rewritten prompt, every constraint kept |
| `applied_techniques` | what changed |
| `suggestions` | what you could still add |
| `quality_before` / `quality_after` | 0–100, estimated |
| `tokens_before` / `tokens_after` | token delta |
| `error` / `hint` | `no_provider` · `bad_config` · `model_failed` · `bad_model_output`, with a readable hint |

Guardrails: 12-char gate (no model call on trivial input) · 30 s provider timeout · deflection
guard with a deterministic fallback · every failure is a JSON error, the process never exits.

## Privacy

Over MCP the key lives in your agent's config, not in `chrome.storage`. Your prompt text goes
only to the provider you configured, exactly like the extension. The server stores nothing.

## Test

```bash
npm test            # unit tests incl. apps/mcp/src/mcp.test.ts
npm run e2e:mcp     # real stdio round-trip against a mock model, no key needed
```
