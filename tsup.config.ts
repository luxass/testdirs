import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "./src/index.ts",
    "./src/sync.ts",
    "./src/helpers.ts",
  ],
  format: ["cjs", "esm"],
  clean: true,
  dts: true,
  treeshake: true,
  bundle: true,
  outExtension(ctx) {
    return {
      js: ctx.format === "cjs" ? ".cjs" : ".mjs",
    };
  },
});
