"use client";
import { useEffect, useRef } from "react";

// Parallax ember field — depth-layered drifting sparks on a canvas.
export function SparkField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let W = 0, H = 0, raf = 0;
    const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    resize();
    addEventListener("resize", resize);

    const parts = Array.from({ length: 48 }, () => ({
      x: Math.random(), y: Math.random(), z: 0.3 + Math.random(),
      r: 0.6 + Math.random() * 1.8, vy: 0.15 + Math.random() * 0.5,
    }));

    let i = 0;
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p, idx) => {
        p.y -= (p.vy * p.z) / H * 6;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        const x = p.x * W + Math.sin(p.y * 8 + idx) * 10 * p.z;
        const y = p.y * H;
        ctx.beginPath();
        ctx.arc(x, y, p.r * p.z * 1.6, 0, 6.283);
        // Rising motes interpolated across the teal accent (#14B8A6 → #2DD4BF)
        const k = Math.min(1, p.z);
        const r = Math.round(20 + k * 25);   // 20 → 45
        const g = Math.round(184 + k * 28);  // 184 → 212
        const b = Math.round(166 + k * 25);  // 166 → 191
        ctx.fillStyle = `rgba(${r},${g},${b},${0.1 + p.z * 0.5})`;
        ctx.fill();
      });
      i++;
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);
  return <canvas id="sparks" ref={ref} aria-hidden />;
}
