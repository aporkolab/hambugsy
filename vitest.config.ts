import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      "test/fixtures/**/*",
      "demo/**/*", // Demo has intentionally failing tests for showcasing hambugsy
    ],
  },
});
