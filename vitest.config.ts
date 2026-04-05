import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "apps/api/src/**/*.{test,spec}.ts",
      "packages/**/*.{test,spec}.ts",
    ],
  },
});
