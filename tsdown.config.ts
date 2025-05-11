import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "./src/index.ts",
    "./src/helpers.ts",
  ],
  format: "esm",
  clean: true,
  dts: true,
  treeshake: true,
  publint: true,
});
