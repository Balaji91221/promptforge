# @promptforge/types

The shared contract. One file, no runtime code.

| Type | Used for |
|---|---|
| `Intent` | The six intent buckets the model classifies into |
| `PromptHelperResult` | What a rewrite returns: refined prompt, techniques, suggestions, scores, token counts |
| `Outcome` | The ground-truth signal: `accepted`, `edited_then_sent`, `dismissed` |
| `PromptEvent` | One stored rewrite plus its outcome |
| `RewriteRequest` | Request body for the optional hosted-mode backend |

Every package and app imports from here so the JSON shape never drifts between
the engine, the shells, and the backend.
