import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node20",
  outDir: "dist",
  clean: true,
  // Bundle @mobile-growth/shared into the output (workspace dep, not on npm)
  // Keep external deps that users install via package.json dependencies
  noExternal: ["@mobile-growth/shared"],
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
