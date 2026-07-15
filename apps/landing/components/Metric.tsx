"use client";
import { useEffect, useRef, useState } from "react";

// Count-up metric that animates once when scrolled into view.
export function Metric({ to, suffix = "", comma = false, k, note }:
  { to: number; suffix?: string; comma?: boolean; k: string; note: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(el);
        if (reduce) { setVal(to); return; }
        let t0: number | null = null;
        const step = (ts: number) => {
          if (t0 === null) t0 = ts;
          const p = Math.min(1, (ts - t0) / 1400);
          setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return (
    <div className="metric reveal" ref={ref}>
      <div className="n">{comma ? val.toLocaleString() : val}{suffix}</div>
      <div className="k">{k}</div>
      <div className="note">{note}</div>
    </div>
  );
}
