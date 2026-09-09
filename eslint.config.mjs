// ESLint flat config. Fast, non-type-aware rules so `npm run lint` stays under
// a few seconds; the type-level checks live in `npm run typecheck`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/*.tsbuildinfo",
      "coverage/**",
      "docs/spikes/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // Shells log deliberately (service-worker console is the only debug surface).
      "no-console": "off",
    },
  },
  {
    // Chrome extension: `chrome` is provided by @types/chrome at runtime.
    files: ["apps/extension-browser/**/*.{ts,tsx}"],
    languageOptions: { globals: { chrome: "readonly", __PF_API__: "readonly" } },
  },
);
