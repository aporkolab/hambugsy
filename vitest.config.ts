import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      "test/fixtures/**/*", // Exclude fixture files from being run as tests
    ],
  },
});
