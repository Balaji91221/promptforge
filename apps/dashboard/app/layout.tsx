import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "PromptForge — Dashboard",
  description: "Cross-platform prompt-quality trend, usage, and headroom.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
