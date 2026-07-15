import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted at build time (no runtime CDN, no CSP issues) — more robust and
// professional than a <link> to Google Fonts.
const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "PromptForge — Forge every prompt",
  description:
    "The cross-provider prompt-engineering assistant. Rewrite messy input into clear, well-engineered prompts, coach yourself better, and see your quality trend — on every AI tool you use.",
  openGraph: {
    title: "PromptForge — Forge every prompt",
    description: "Rewrite · Coach · Measure — across every AI tool.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
