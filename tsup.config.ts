import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/bin.ts",
    action: "src/action-bin.ts",
  },
  format: ["cjs"],
  outExtension: () => ({ js: ".cjs" }),
  target: "node18",
  platform: "node",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  shims: true,
});
