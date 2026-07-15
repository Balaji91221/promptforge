import { Nav } from "../components/Nav";
import { Enhancers } from "../components/Enhancers";
import { SparkField } from "../components/SparkField";
import { RewriteDemo } from "../components/RewriteDemo";
import { Metric } from "../components/Metric";
import { Cta } from "../components/Cta";
import { PLATFORMS } from "../lib/links";
import type { CSSProperties } from "react";

const cssI = (i: number): CSSProperties => ({ ["--i" as string]: i }) as CSSProperties;

const HEADLINE: { t: string; glow?: boolean; br?: boolean }[] = [
  { t: "Forge" }, { t: "every" }, { t: "prompt." }, { t: "", br: true },
  { t: "Master", glow: true }, { t: "the" }, { t: "craft." },
];

const LOOP = [
  { ico: "⚒", n: "01", h: "Rewrite", p: "Raw input becomes a clear, complete prompt — every constraint preserved, nothing invented." },
  { ico: "◎", n: "02", h: "Coach", p: "Inline tips on what's missing, so you learn prompt engineering instead of just outsourcing it." },
  { ico: "📈", n: "03", h: "Measure", p: "Acceptance, edits, quality trend — the honest, behavioral signal that you're getting better." },
  { ico: "⇄", n: "04", h: "Everywhere", p: "Claude, ChatGPT, Gemini, Grok, Perplexity — one engine, every input box." },
];

export default function Page() {
  const marquee = [...PLATFORMS, ...PLATFORMS];
  return (
    <>
      <Enhancers />
      <SparkField />
      <Nav />

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow" style={{ opacity: 0, animation: "fade 1s ease .1s forwards" }}>
                Cross-provider · prompt-engineering assistant
              </p>
              <h1 className="h1">
                {HEADLINE.map((w, i) =>
                  w.br ? <br key={i} /> : (
                    <span key={i} className={`word${w.glow ? " glow" : ""}`} style={cssI(i)}>
                      {w.t}{" "}
                    </span>
                  ),
                )}
              </h1>
              <p className="lead">
                Rewrite messy input into clear, well-engineered prompts, coach yourself toward better
                prompting, and watch your quality trend climb — on{" "}
                <strong style={{ color: "var(--ink)" }}>every</strong> AI tool you already use.
              </p>
              <div className="hero-actions">
                <Cta to="store" className="btn primary">Add to browser — free</Cta>
                <a href="#loop" className="btn ghost">See how it works</a>
              </div>
              <div className="trust">
                <span><b>5</b> platforms covered</span>
                <span><b>&lt;1s</b> to first token</span>
                <span><b>Local-first</b> — your words stay yours</span>
              </div>
            </div>
            <RewriteDemo />
          </div>
        </section>

        {/* THE LOOP */}
        <section id="loop">
          <div className="wrap">
            <p className="eyebrow reveal">The defensible loop</p>
            <h2 className="reveal" style={cssI(1)}>
              Not a rewrite button.<br />A loop no single provider can copy.
            </h2>
            <p className="lead reveal" style={cssI(2)}>
              Any model could ship &ldquo;improve my prompt&rdquo; tomorrow — inside its own walls. The moat is the
              whole loop, working across every tool, with your growth history living with you.
            </p>
            <div className="loop">
              {LOOP.map((n, i) => (
                <div key={n.n} className="node reveal" style={cssI(i)}>
                  <div className="ico">{n.ico}</div>
                  <div className="num">{n.n}</div>
                  <h3>{n.h}</h3>
                  <p>{n.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MODES */}
        <section id="modes">
          <div className="wrap">
            <p className="eyebrow reveal">Two modes, one engine</p>
            <h2 className="reveal" style={cssI(1)}>Do it for me — or teach me.</h2>
            <div className="two">
              <div className="mode reveal" style={cssI(0)} data-speed="0.6">
                <h3>Auto-refine</h3>
                <p style={{ color: "var(--steel)" }}>One tap. A best-practice prompt, streamed in as it generates, ready to send.</p>
                <ul>
                  <li>Rule pre-clean runs instantly — zero perceived latency</li>
                  <li>First token in under a second, or it degrades gracefully</li>
                  <li>Always keeps your original and shows the diff</li>
                </ul>
              </div>
              <div className="mode reveal" style={cssI(1)} data-speed="1.2">
                <h3>Coach</h3>
                <p style={{ color: "var(--steel)" }}>Inline suggestions on what to add next — the part that makes you better over time.</p>
                <ul>
                  <li>Flags missing context, format, and success criteria</li>
                  <li>Applies techniques only where they help — never bloats a simple ask</li>
                  <li>Keeps your voice and your language</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* PROVIDERS */}
        <div className="providers" id="coverage" aria-label="Supported platforms">
          <div className="track">
            {marquee.map((p, i) => (
              <span key={`a${i}`} className="pill"><span className="d" />{p}</span>
            ))}
          </div>
          <div className="track rev">
            {marquee.map((p, i) => (
              <span key={`b${i}`} className="pill"><span className="d" />{p}</span>
            ))}
          </div>
        </div>

        {/* PROOF */}
        <section id="proof">
          <div className="wrap">
            <p className="eyebrow reveal">Proof, not vibes</p>
            <h2 className="reveal" style={cssI(1)}>Value you can see — within your plan.</h2>
            <p className="lead reveal" style={cssI(2)}>
              You pay a flat subscription, so the win is doing <em>more</em> within it: more messages before
              limits, more room for context, better answers. Every number is measured from real usage.
            </p>
            <div className="metrics">
              <Metric to={47} suffix="%" k="Rewrite acceptance" note="The G0 signal — target ≥ 40%" />
              <Metric to={21400} comma k="Tokens saved" note="≈ 53 extra messages bought" />
              <Metric to={5} k="Platforms, one engine" note="Browser → VS Code → CLI" />
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final" id="get">
          <div className="wrap">
            <div className="card reveal">
              <p className="eyebrow" style={{ justifySelf: "center" }}>Start forging</p>
              <h2>Better prompts, on every tool,<br />starting with your next message.</h2>
              <p className="lead" style={{ marginInline: "auto", marginBottom: "1.8rem" }}>
                Free to install. Local-first. Your words leave the device only when you tap forge.
              </p>
              <div className="hero-actions" style={{ justifyContent: "center" }}>
                <Cta to="store" className="btn primary">Add to Chrome</Cta>
                <Cta to="github" className="btn ghost">View on GitHub</Cta>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="foot-in">
          <span className="brand" style={{ fontSize: "1rem" }}><span className="spark" /> PromptForge</span>
          <span>Rewrite · Coach · Measure — across every AI tool. Proposed name; verify trademark before launch.</span>
        </div>
      </footer>
    </>
  );
}
