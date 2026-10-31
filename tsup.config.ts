import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node24",
  external: ["typescript"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
