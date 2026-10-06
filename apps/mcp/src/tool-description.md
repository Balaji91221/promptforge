Rewrite a vague, messy or underspecified request into a clear, well-engineered prompt.

Call this when the user says "forge", "improve my prompt", "rewrite this prompt", or
when their request is ambiguous enough that you would otherwise have to guess intent,
output format or constraints. Pass the user's raw text as `input`, unchanged.

Returns JSON: `refined_prompt` (use this as the task), `applied_techniques` (what
changed), `suggestions` (what the user could still add), `quality_before` /
`quality_after` (0–100, estimated), `tokens_before` / `tokens_after`.

Before acting on `refined_prompt`, show the user the refined text and the
`applied_techniques` list in 2–4 lines, so they can correct it. Never invent
constraints that are not in the input; the tool preserves every constraint it finds.

If the result has `status: "too_short"`, the input was trivial — proceed with the
original text. If it has `error`, tell the user the `hint` verbatim; do not retry.
