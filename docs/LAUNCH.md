# Launching PromptForge as an open-source project

Written 2026-10-06. A working list, not a plan: pick what fits, strike the rest.
Items marked **do first** are the ones that most change how a stranger judges the repo
in the first 30 seconds.

## 1. Before anyone sees it (this week)

| # | Item | Why | Effort |
|---|---|---|---|
| 1 | **do first** Push `main` (2 commits ahead) | the MCP server and the new README exist only on this laptop | 1 min |
| 2 | **do first** 20-second GIF of a real forge on chatgpt.com, top of the README | a GIF converts 5× better than a screenshot; the current screenshot shows mock output | 30 min |
| 3 | **do first** Run one real-model test and replace "sample output" in the caption | honesty, and you want to see the real quality yourself before others do | 15 min once a key or Ollama is available |
| 4 | GitHub Release `v0.1.0` with a zipped `apps/extension-browser/dist` | most people will not run `npm install` to try an extension; a zip + Load unpacked is a 1-minute try | 20 min |
| 5 | Fix end-user jargon in the popup: "G0 target", "§7" | they are plan references, meaningless to a user; say "Target acceptance ≥ 40%" | 15 min |
| 6 | Repo topics: `prompt-engineering`, `chrome-extension`, `mcp`, `mcp-server`, `claude-code`, `llm`, `ollama`, `typescript`, `developer-tools` | GitHub topic pages are a discovery channel | 2 min |
| 7 | Enable Discussions and pin a "Welcome / what are you using it for?" thread | the issue template already links to Discussions; make sure it exists | 5 min |
| 8 | Add `good first issue` and `help wanted` labels to 5 real tasks (one per adapter to verify, one provider, one eval case) | contributors look for these labels specifically | 20 min |
| 9 | Social preview image (1280×640) in repo settings | the card shown when the link is shared on X / LinkedIn / Reddit | 20 min |
| 10 | Verify claude.ai, Gemini, Grok, Perplexity once each while logged in; update the Status table | launch on the strength of what is true | 30 min |

## 2. Make it easy to try (install friction)

- **Chrome Web Store listing** even as "unlisted" first. Developer account is a one-time $5. Unlisted gives a share link without the public review wait. Then public once acceptance data is in.
- **`npx @promptforge/mcp`**: publish `apps/mcp` to npm. Turns five config blocks into one line each: `"command": "npx", "args": ["-y", "@promptforge/mcp"]`. Needs `files` whitelist, `prepublishOnly: npm run build`, and bundling core (or publishing `@promptforge/core` too).
- **Claude Code plugin / skill**: a `.claude-plugin` manifest so a one-line `claude plugin add …` (verify the exact command against the Claude Code plugin docs) installs the MCP server, a `/forge` command and the auto-forge hook together. This is the single best distribution channel for the agent side.
- **Cursor one-click**: Cursor supports MCP install deep links (`cursor://anysphere.cursor-deeplink/mcp/install?…`; verify the exact format against Cursor's docs). Add an "Add to Cursor" button to the README.
- **Firefox**: MV3 is mostly compatible; the build is a Vite target. Firefox users are over-represented in privacy-minded, local-first audiences, which is exactly your pitch.
- **Homebrew tap** for the MCP server, later, if the CLI audience grows.

## 3. Prove it works (trust)

- **Publish the eval numbers.** `npm run eval` against Llama 3.1 8B, GPT-4o-mini and Claude Haiku. Put a small table in the README: pass rate, median latency, cost per forge. Numbers beat adjectives, and nobody else in this space publishes them.
- **Acceptance-rate dashboard, opt-in and anonymous.** Right now the G0 signal lives only on each user's device. An opt-in "share my acceptance rate" toggle that posts one number per week would let you publish "users accept N% of rewrites" on the README. Keep it off by default, keep it a single integer.
- **A `docs/EVALS.md`** that explains the eval cases, how to add one, and how a meta-prompt change is accepted. Contributors to prompts need to see the bar.
- **Badges that mean something**: tests count, eval pass rate (shields.io endpoint badge from a JSON file in the repo updated by CI).
- **Security posture page**: permissions requested and why, what the content script can see, what leaves the device. Half your pitch is privacy; show the receipts.

## 4. Product enhancements worth doing early

Ordered by my estimate of value per hour.

1. **Auto-forge hook for Claude Code** (`UserPromptSubmit`). Forge every vague prompt without asking. The single biggest UX change for the agent side.
2. **Code-mode meta-prompt.** Coding requests need: file paths, expected vs actual, how to reproduce, test command, constraints. A separate template and 10 eval cases.
3. **Context-aware forge in agents.** Pass cwd, git branch, open files into the tool so the refined prompt names real files.
4. **Keyboard shortcut** in the extension (e.g. `Alt+F`) so power users never reach for the mouse.
5. **"Forge once, learn forever" digest**: after 20 forges, a popup panel that says "your top 3 missing elements: output format (14×), audience (9×), examples (7×)". That is the coaching promise made visible.
6. **History panel**: last 20 forges with original → refined, exportable as Markdown. People will want to reuse good prompts.
7. **Templates per intent** the user can edit: a "my email prompts always include X" override.
8. **Streaming the rewrite** into the overlay. Perceived latency halves.
9. **Multi-language**: detect input language, forge in the same language. Large audience outside English.
10. **Site adapters**: Mistral Le Chat, DeepSeek, Poe, Copilot, Meta AI, HuggingChat. Each is one file; each is a `good first issue`.
11. **Diff view** in the overlay (word-level original vs refined) instead of two blocks.
12. **Accessibility pass**: keyboard navigation in the overlay, ARIA labels, focus return to the chat box after Accept.

## 5. Open-source hygiene

- `CODEOWNERS` so review requests route to you automatically.
- Branch protection on `main`: CI must pass, no force push.
- Release workflow: tag → build → zip dist → GitHub Release → npm publish. One `release.yml`.
- `CHANGELOG.md` follows Keep a Changelog already; cut `[0.1.0]` from `[Unreleased]` at launch.
- Issue templates exist. Add a third: "Site adapter broken" with fields for site, what you typed, console error.
- A `SUPPORT.md` pointing to Discussions for questions, Issues for bugs.
- Dependabot is on; add `npm audit` to CI so a known-vuln dependency fails the build.
- License headers are not needed for MIT, but a `NOTICE` for the Headroom-inspired compressor is good manners.
- Pin Node in CI to the `.nvmrc` (already done) and test on both Node 22 and 24 in a matrix.
- `all-contributors` bot or a hand-maintained Contributors section once PRs arrive.

## 6. Where and how to announce

Launch order that tends to work for dev tools: niche first, broad last, each one carrying proof from the previous.

| Day | Channel | Angle |
|---|---|---|
| 0 | X / LinkedIn personal post with the GIF | "I built a Forge button for every AI chat, local-first, MIT" |
| 0 | Anthropic Discord `#claude-code` and `#mcp`, Cursor forum, OpenAI developer forum | the MCP server angle: one tool, five agents |
| 1 | r/ClaudeAI, r/ChatGPT, r/LocalLLaMA (Ollama angle), r/PromptEngineering | one post per subreddit, tailored; read each sub's self-promo rules first |
| 2 | Hacker News "Show HN: PromptForge – a Forge button for every AI chat (local-first, MIT)" | post 8–10 am US Eastern, Tue–Thu; be in the thread for 3 hours answering |
| 3 | dev.to / Hashnode write-up: "What 148 tests taught me about prompt rewriting" or the paste-compression spike (real numbers, real tables) | the technical story gets shared by people who did not try the tool |
| 7 | Product Hunt, only after the Web Store unlisted link exists | needs a 1-click try or it flops |
| 7+ | awesome-lists: awesome-mcp-servers, awesome-chatgpt, awesome-claude, awesome-chrome-extensions | long-tail discovery; PRs to those repos |
| ongoing | Short clips: "before / after" of one forge, 15 s, posted 2× a week | the product is visual; show it |

Pitch lines to test:
- "Type like you talk. Send a prompt an expert would write."
- "A Forge button for every AI chat. Your words never leave the device until you tap."
- "One MCP tool that makes Claude Code, Codex and Cursor ask better questions."

## 7. What to measure after launch

- GitHub stars and clones per day (Insights → Traffic), by referrer.
- Issues opened by strangers in the first 14 days. Even bug reports are a strong signal.
- Discussions "what are you using it for" replies: the first 10 tell you who the real audience is.
- Acceptance rate if the opt-in telemetry ships. Below 40% means the meta-prompt needs work before any marketing.
- Time to first contributor PR. If it is more than 30 days, the `good first issue` list is too thin.

## 8. Risks to say out loud

- **Site breakage.** Chat UIs change HTML weekly. Adapters will break. Mitigation: the fallback selector logic already exists; add a "report broken site" link in the overlay; keep selectors in `config/` so a fix is a one-line PR.
- **Free tier dependence.** NVIDIA NIM's free tier can change. Mitigation: Ollama path documented; OpenRouter free models as a second fallback.
- **"Another prompt tool" fatigue.** There are many. Your differentiators are: in-place, local-first, coaching with technique names, measured acceptance, and now agents via MCP. Lead with those; do not lead with "prompt optimizer".
- **Maintainer bandwidth.** One person. Say so in the README ("maintained by one person, response time a few days"), and let the labels and templates do the triage.
