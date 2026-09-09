// The rewrite overlay (Coach + Auto-refine surfaces share this).
// Renders the streaming rewrite, "what changed", coaching tips, token delta,
// and accept / edit / dismiss — the ground-truth outcome buttons (§7).

import { useEffect, useState } from "react";
import { parseResult, estimateTokens } from "@promptforge/core";
import type { PromptHelperResult, Outcome } from "@promptforge/types";
import { streamRewrite } from "./rewrite-client.js";

interface Props {
  rawInput: string;
  coach?: boolean;
  /** BYO provider path: when supplied, used instead of the hosted stream. */
  refineFn?: (raw: string) => Promise<PromptHelperResult>;
  onOutcome: (outcome: Outcome, result: PromptHelperResult) => void;
  onClose: () => void;
}

type Phase = "streaming" | "ready" | "error";

export function Overlay({ rawInput, coach = true, refineFn, onOutcome, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("streaming");
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<PromptHelperResult | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    // BYO provider path — single request via the selected model (no streaming).
    if (refineFn) {
      refineFn(rawInput)
        .then((r) => { if (!cancelled) { setResult(r); setPhase("ready"); } })
        .catch((e) => { if (!cancelled) { setError((e as Error).message); setPhase("error"); } });
      return () => { cancelled = true; };
    }

    void streamRewrite(rawInput, {
      onText: (acc) => !cancelled && setStreamText(acc),
      onDone: (full) => {
        if (cancelled) return;
        try {
          setResult(parseResult(full));
          setPhase("ready");
        } catch (e) {
          setError((e as Error).message);
          setPhase("error");
        }
      },
      onError: (msg) => {
        if (cancelled) return;
        setError(msg);
        setPhase("error");
      },
    });
    return () => {
      cancelled = true;
    };
  }, [rawInput]);

  const refined = edited ?? result?.refined_prompt ?? "";
  const before = result?.tokens_before ?? estimateTokens(rawInput);
  const after = estimateTokens(refined);

  return (
    <div style={S.card} role="dialog" aria-label="PromptForge rewrite">
      <div style={S.head}>
        <span style={S.brand}>▪ PromptForge</span>
        <button style={S.x} onClick={onClose} aria-label="Dismiss">✕</button>
      </div>

      {phase === "error" && (
        <p style={S.err}>Couldn't rewrite: {error}. Falling back to your original.</p>
      )}

      {phase === "streaming" && (
        <pre style={S.stream}>{streamText || "Forging a clearer prompt…"}</pre>
      )}

      {phase === "ready" && result && (
        <>
          <textarea
            style={S.textarea}
            value={refined}
            onChange={(e) => setEdited(e.target.value)}
            aria-label="Refined prompt (editable)"
          />
          <div style={S.meta}>
            <span>~{before} → {after} tokens</span>
            <span>quality (est.) {result.quality_before} → {result.quality_after}</span>
          </div>
          {result.compression && (
            <div style={S.meta} title={result.compression.transforms.join(", ")}>
              <span>
                attached data {result.compression.tokens_before.toLocaleString()} →{" "}
                {result.compression.tokens_after.toLocaleString()} tokens
              </span>
              <span>compressed on-device · {result.compression.provider === "builtin" ? "built-in" : "Headroom"}</span>
            </div>
          )}

          {result.applied_techniques.length > 0 && (
            <Section title="What changed" items={result.applied_techniques} />
          )}
          {coach && result.suggestions.length > 0 && (
            <Section title="Coach — could still add" items={result.suggestions} />
          )}

          <div style={S.actions}>
            <button
              style={S.primary}
              onClick={() =>
                onOutcome(edited ? "edited_then_sent" : "accepted", { ...result, refined_prompt: refined })
              }
            >
              {edited ? "Use edited" : "Accept"}
            </button>
            <button style={S.ghost} onClick={() => onOutcome("dismissed", result)}>
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <ul style={S.ul}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

const TEAL = "#14B8A6";
const S: Record<string, React.CSSProperties> = {
  card: {
    position: "fixed", right: 20, bottom: 96, width: 380, maxHeight: "70vh", overflowY: "auto",
    background: "#0E1622", color: "#B9C4CE", border: "1px solid #233042", borderRadius: 12,
    padding: 14, zIndex: 2147483647, fontFamily: "system-ui, sans-serif", fontSize: 13,
    boxShadow: "0 18px 40px -18px rgba(0,0,0,.6)",
  },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  brand: { color: TEAL, fontWeight: 700, letterSpacing: ".02em" },
  x: { background: "none", border: "none", color: "#6C7884", cursor: "pointer", fontSize: 14 },
  stream: { whiteSpace: "pre-wrap", background: "#0B1220", padding: 10, borderRadius: 8, margin: 0, fontSize: 12.5, lineHeight: 1.5 },
  textarea: { width: "100%", minHeight: 120, background: "#0B1220", color: "#EAF1F8", border: "1px solid #233042", borderRadius: 8, padding: 10, fontFamily: "inherit", fontSize: 12.5, resize: "vertical" },
  meta: { display: "flex", justifyContent: "space-between", color: "#6C7884", fontSize: 11.5, margin: "8px 0" },
  section: { marginTop: 8 },
  sectionTitle: { color: TEAL, fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 },
  ul: { margin: 0, paddingLeft: 16 },
  actions: { display: "flex", gap: 8, marginTop: 12 },
  primary: { flex: 1, background: TEAL, color: "#06231F", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 },
  ghost: { background: "none", color: "#B9C4CE", border: "1px solid #233042", borderRadius: 8, padding: "8px 12px", cursor: "pointer" },
  err: { color: "#FF8A8A" },
};
