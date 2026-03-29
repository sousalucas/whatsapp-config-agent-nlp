import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["e2e/cli/**/*.spec.ts"],
    testTimeout: 30_000,
  },
});
