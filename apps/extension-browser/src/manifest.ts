import { defineManifest } from "@crxjs/vite-plugin";
import { allHosts } from "@promptforge/adapters";

// Provider API hosts — the background worker fetches these directly (CORS-free).
const PROVIDER_HOSTS = [
  "https://integrate.api.nvidia.com/*",
  "https://api.openai.com/*",
  "https://api.anthropic.com/*",
  "https://router.huggingface.co/*",
  "https://openrouter.ai/*",
  "http://localhost/*",
  "http://127.0.0.1/*",
];

// Store-safe (§16): host access ONLY for supported sites — never <all_urls>.
// Each platform we add is an explicit, visible permission. Single clear purpose.
export default defineManifest({
  manifest_version: 3,
  name: "PromptForge — Prompt Helper",
  version: "0.1.0",
  description:
    "Rewrite your messy input into a clear, well-engineered prompt — right where you type, across every AI chat.",
  permissions: ["storage"],
  host_permissions: [...allHosts, ...PROVIDER_HOSTS],
  action: { default_popup: "src/popup/index.html" },
  background: { service_worker: "src/background/index.ts", type: "module" },
  content_scripts: [
    {
      matches: allHosts,
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
});
