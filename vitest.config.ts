import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    /** Slow / port-bound Nest + Socket.IO harness — run locally or in a dedicated e2e job. */
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.e2e.test.ts"],
    include: [
      "apps/api/src/**/*.{test,spec}.ts",
      "packages/**/*.{test,spec}.ts",
    ],
  },
});
