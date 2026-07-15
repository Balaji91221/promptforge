import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    // Test against source, not dist, so tests never run against stale builds.
    alias: {
      "@promptforge/types": new URL("./packages/types/src/index.ts", import.meta.url).pathname,
      "@promptforge/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@promptforge/adapters": new URL("./packages/adapters/src/index.ts", import.meta.url).pathname,
    },
  },
});
