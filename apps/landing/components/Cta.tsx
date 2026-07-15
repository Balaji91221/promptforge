import { LINKS } from "../lib/links";

// External CTA link — one source of truth for destinations (lib/links.ts).
export function Cta({ to, className, children }:
  { to: keyof typeof LINKS; className?: string; children: React.ReactNode }) {
  return (
    <a href={LINKS[to]} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
