import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false, // CLI doesn't need types; also avoids tsconfig incremental conflict
  clean: true,
  sourcemap: true,
  /**
   * Bundle workspace dependencies so they don't need to be published separately.
   */
  noExternal: ["@herbcaudill/ralph-shared"],
})
