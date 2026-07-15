"use client";
import { useEffect } from "react";

// Progress bar + sticky-nav blur + parallax layers + scroll reveals.
// Operates on the server-rendered DOM so all content is present without JS.
export function Enhancers() {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bar = document.getElementById("bar");
    const nav = document.getElementById("nav");
    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-speed]"));

    const onScroll = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
      nav?.classList.toggle("stuck", scrollY > 24);
      if (!reduce) {
        for (const el of layers) {
          const s = parseFloat(el.dataset.speed || "0");
          const r = el.getBoundingClientRect();
          const off = r.top + r.height / 2 - innerHeight / 2;
          el.style.transform = `translateY(${(off * s * -0.06).toFixed(1)}px)`;
        }
      }
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    return () => { removeEventListener("scroll", onScroll); io.disconnect(); };
  }, []);

  return (
    <>
      <div id="bar" />
      <div className="veil" />
    </>
  );
}
