import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/router.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  dts: true,
  clean: true,
});
