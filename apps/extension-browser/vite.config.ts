import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.js";

// Backend rewrite endpoint (Phase 0: one serverless function).
// Override at build time: PF_API=https://your-deploy/api/rewrite
const API = process.env.PF_API ?? "http://localhost:3000/api/rewrite";

export default defineConfig({
  define: { __PF_API__: JSON.stringify(API) },
  plugins: [react(), crx({ manifest })],
});
