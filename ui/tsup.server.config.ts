import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["server/index.ts"],
  format: ["esm"],
  dts: false, // Server types not needed at runtime; avoids tsconfig conflicts
  clean: false, // Don't clean since vite also outputs to dist
  sourcemap: true,
  outDir: "dist/server",
  /**
   * Bundle workspace dependencies so they don't need to be published separately.
   */
  noExternal: ["@herbcaudill/ralph-shared"],
})
