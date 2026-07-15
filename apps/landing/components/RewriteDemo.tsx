"use client";
import { useEffect, useRef, useState } from "react";

interface Scene { in: string; out: string; t: string; q: string; }
const SCENES: Scene[] = [
  { in: "summarize this article for me pls its really long",
    out: "Summarize the article below in 5 bullet points, preserving the key facts and any figures. Keep it under 120 words, neutral tone.",
    t: "~9 → 34 tokens", q: "+58" },
  { in: "make my resume better java spring 3yrs fintech job",
    out: "Act as a senior tech recruiter. Rewrite my resume summary for a fintech backend role, highlighting 3 years of Java + Spring Boot experience. Keep it to 3 lines, quantify impact.",
    t: "~11 → 41 tokens", q: "+52" },
  { in: "explain how https works like im 12",
    out: "Explain how HTTPS works to a curious 12-year-old. Use one everyday analogy, avoid jargon, and end with why the padlock matters. ~150 words.",
    t: "~8 → 33 tokens", q: "+55" },
];
const CHIPS = ["+ role", "+ context", "+ output format", "+ success criteria"];

export function RewriteDemo() {
  const [raw, setRaw] = useState("");
  const [refined, setRefined] = useState("Waiting for input…");
  const [refinedOn, setRefinedOn] = useState(false);
  const [chipsOn, setChipsOn] = useState(false);
  const [meta, setMeta] = useState({ t: "~0 → 0 tokens", q: "+0" });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let si = 0;
    let alive = true;
    const wait = (ms: number) => new Promise<void>((r) => timers.current.push(setTimeout(r, ms)));

    const type = async (str: string, set: (s: string) => void) => {
      if (reduce) { set(str); return; }
      for (let i = 0; i <= str.length && alive; i++) {
        set(str.slice(0, i));
        await wait(26 + Math.random() * 30);
      }
    };

    const loop = async () => {
      while (alive) {
        const s = SCENES[si]!;
        setChipsOn(false); setRefinedOn(false);
        setRefined("Forging…"); setMeta({ t: "~ → tokens", q: "+0" });
        await type(s.in, setRaw);
        await wait(400);
        setRefinedOn(true); setRefined("");
        await type(s.out, setRefined);
        setChipsOn(true);
        setMeta({ t: s.t, q: s.q });
        si = (si + 1) % SCENES.length;
        await wait(3200);
      }
    };
    void loop();
    return () => { alive = false; timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);

  return (
    <div className="demo" data-speed="-1.4">
      <div className="bar">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="lbl">promptforge · live rewrite</span>
      </div>
      <div className="body">
        <div className="tag">Your input</div>
        <div className="row raw">{raw}<span className="caret" /></div>
        <div className="arrow"><span className="ln" />⚒ forged<span className="ln" /></div>
        <div className="tag">Engineered prompt</div>
        <div className="row refined" style={{ opacity: refinedOn ? 1 : 0.35 }}>{refined}</div>
        <div className="chips">
          {CHIPS.map((c, i) => (
            <span key={c} className={`chip${chipsOn ? " on" : ""}`} style={{ animationDelay: `${i * 0.16}s` }}>{c}</span>
          ))}
        </div>
        <div className="foot"><span>{meta.t}</span><span>quality <b>{meta.q}</b></span></div>
      </div>
    </div>
  );
}
