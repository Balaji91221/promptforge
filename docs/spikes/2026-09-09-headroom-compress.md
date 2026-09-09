# Spike: Headroom /v1/compress for PromptForge long pastes — 2026-09-09

**Question:** does Headroom's local compress save ≥30% tokens on realistic pastes
(log, JSON, prose) without dropping strings the user's prompt must preserve?

**Setup:** headroom-ai[proxy] in an isolated uv venv, two builds compared:
x86_64-under-Rosetta (proxy reported 0.35.0, uv resolved an older wheel) and native
arm64 (0.37.0). Arch AND version changed between passes, so the latency drop cannot
be attributed to one of them. Proxy on :8787,
28 MB RSS before the optional Kompress ML model loads, 383 MB after. Install 13–19 s,
~500 MB on disk, startup 22–34 s, zero network calls.
Tokens counted by the proxy for model gpt-4o. Latency = wall time of POST /v1/compress.

## Results, native arm64, unique payloads (no proxy cache)

| paste | tokens before → after | saved | latency | must-preserve | transform |
|---|---|---|---|---|---|
| JSON array, 60 objs | 7780 → 3976 | 49% | 27 ms | all kept | router:mixed (SmartCrusher) |
| JSON array, 40 objs | 1314 → 564 | 57% | 18–34 ms | all kept | router:mixed |
| **JSON array, 500 objs, one 2,000-char field** | 29220 → 14736 | 50% | 873 ms cold, 60 ms warm | **500/500 ids, full string intact** | router:mixed |
| same, sent as tool-result message | 29239 → 14755 | 50% | 64 ms | 500/500 ids | router:mixed |
| log, 140 lines + traceback | 5136 → 3730 | 27% | 1.9 s (ML loaded) | all kept | router:search |
| log, 320 repetitive lines, ML not yet loaded | 7757 → 4886 | 37% | 24–46 ms | all kept | router:search |
| log, same, ML loaded | 7757 → 4617 | 40% | 3.8 s | all kept | router:search |
| prose, 6 paras | 606 → 471 | 22% | 0.85 s | **LOST "twelve per month to two"** (also clipped the instruction line, a spike artifact: instruction and payload shared one message) | router:text (Kompress) |
| prose, 18 paras | 1830 → 1420 | 22% | 2.7 s | **LOST "twelve per month to two"** | router:text |

Kompress (the ML text model) reported `status: degraded, ready: false` at startup and
was not ready for the first two probe runs; until then text is `router:noop` and logs
take 24–46 ms. Cold first call after proxy start: 1,170 ms (x86 log), 10,633 ms (arm64,
returned noop), 873 ms (arm64 500-item JSON). The build needs a warm-up or a
"starting" state. Proxy RSS: 28 MB before the ML model loads, 383 MB after. Once loaded it adds
2–4 s per call for +3% on logs and lossy prose.

## Results, x86_64 under Rosetta (first pass, kept for reference)

| paste | tokens before → after | saved | latency | must-preserve | transform |
|---|---|---|---|---|---|
| JSON array, 60 objs | 7780 → 4097 | 47% | 10–50 ms | all kept | router:mixed (SmartCrusher) |
| JSON array, 40 objs | 1314 → 605 | 54% | 15–24 ms | all kept | router:mixed |
| log, 140 lines + traceback | 5136 → 3885 | 24% | 1.2 s cold | all kept | router:search |
| log, 320 repetitive lines + traceback | 7757 → 4617 | 40% | 7.2–8.1 s | all kept | router:search |
| prose, 6 paras | 606 → 606 | 0% | 5 ms | n/a | router:noop |
| prose, 18 paras | 1830 → 1420 | 22% | 5.2–7.4 s | **LOST "twelve per month to two"** | router:text (Kompress ML) |

Identical payloads re-sent hit a proxy cache: 4–37 ms regardless of type. Do not
trust warm numbers.

## What did NOT work, and why

- **Prose compression drops facts.** The ML text route (Kompress) removed a
  concrete number-bearing phrase in 5/5 runs. Violates PromptForge's "nothing
  dropped" promise. Kill for prose.
- **The ML text model is the slow part, not the platform.** Native arm64 cut it
  from 5–8 s to 2–4 s, still far over a tap-to-overlay budget. Rosetta added a
  2× penalty and broke Magika detection ("requires AVX2"). Logs are routed as
  "search" on both builds. Unknown: whether Kompress can be disabled by config so
  logs stay at 24–46 ms — test `headroom proxy --help` / config keys next.
- **Output quirk:** compressed payload comes back as a JSON-string literal
  (leading quote, literal \n escapes, 1 real newline). Must unescape before
  showing it in the overlay or writing it into the chat box.
- **My earlier gotcha was wrong:** the default config already compressed user
  messages on /v1/compress. compress_user_messages / frozen_message_count made
  no difference (A = B = C, D = E in run 1).

## Decision

**Build, narrowly.** JSON / array-like pastes only, opt-in, local. Logs are a maybe
pending a Kompress-off config. Prose is a no.
- gate: ≥400 tokens, proxy /health ok, client timeout 1.5 s, else use original
- accept result only if saved ≥25% AND transform is not router:text
- never compress the instruction line; only the pasted payload
- unescape the payload; show "before → after tokens (Headroom)" in the overlay
- add eval cases with must_preserve for compressed pastes

## Untested

- Calls from an MV3 service worker: loopback-only check and the `chrome-extension://`
  Origin were exercised only from Node. Make this step one of the build.
- Whether Kompress can be disabled by config so logs stay at 24–46 ms.
- Logs were routed as `search` on both builds; the run-collapse fold never triggered.

## Top 2 risks for the real build

1. Kompress ML route: 2–4 s native (vs ~1 s for the Llama 8B rewrite itself) and
   drops facts. Mitigation: tool-result shape, transform allowlist rejecting
   `router:text`, 1.5 s client timeout with fallback to the original.
2. Cold start: first call after proxy start took 0.9–10.6 s. Mitigation: /health
   probe on popup open, "compressor starting" state, never block Forge on it.

## Cost per run

0 network calls, 0 API cost. ~500 MB disk, Python 3.10+, 13–19 s install (uv),
10–34 s startup, 28–383 MB RAM. Compression itself: 18–64 ms warm on JSON.

## Throwaway vs will-hurt-later

Throwaway: the venv, spike scripts, synthetic pastes. Real build work: the
tool-result message shape, the transform allowlist, the timeout/fallback path,
and eval cases with must_preserve strings for compressed pastes.

## Files
- spike-headroom.ts, spike2.mts, spike3.mts, spike4.mts — probes
- spike-run1.txt, spike-run2.txt — raw output
- hr-venv-arm/ — throwaway native proxy install (~500 MB), proxy.log, proxy-arm.log, install-arm.log
- x86 venv deleted after the comparison
