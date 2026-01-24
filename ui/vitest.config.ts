import { defineConfig, mergeConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import react from "@vitejs/plugin-react"
import path from "path"
import viteConfig from "./vite.config"

/**
 * Vitest configuration with two projects:
 * - Unit tests: Run with jsdom environment
 * - Storybook tests: Run in real browser via Playwright
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    test: {
      projects: [
        // Unit tests with jsdom
        {
          extends: true,
          test: {
            name: "unit",
            environment: "jsdom",
            globals: true,
            setupFiles: ["./src/vitest-setup.ts"],
            exclude: ["node_modules", "e2e"],
            include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
            environmentMatchGlobs: [["server/**/*.test.ts", "node"]],
            hookTimeout: 60000,
            testTimeout: 60000,
          },
        },
        // Storybook browser tests
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: path.join(import.meta.dirname, ".storybook"),
            }),
          ],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              provider: playwright({}),
              headless: true,
              instances: [{ browser: "chromium" }],
            },
            setupFiles: ["./.storybook/vitest.setup.ts"],
          },
        },
      ],
    },
  }),
)
