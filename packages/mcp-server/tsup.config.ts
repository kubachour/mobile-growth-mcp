import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node20",
  outDir: "dist",
  clean: true,
  // Bundle @mobile-growth/shared into the output (workspace dep, not on npm)
  // Keep external deps that users install via package.json dependencies
  noExternal: ["@mobile-growth/shared"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
