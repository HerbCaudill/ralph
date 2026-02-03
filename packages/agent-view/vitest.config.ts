import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: false,
    environment: "jsdom",
    setupFiles: ["./src/vitest-setup.ts"],
  },
})
