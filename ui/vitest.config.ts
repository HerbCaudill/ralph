import { defineConfig, mergeConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import react from "@vitejs/plugin-react"
import path from "path"
import viteConfig from "./vite.config"

/** Use minimal output when Ralph is running to save tokens */
const isRalphRunning = !!process.env.RALPH_RUNNING

/**
 * Vitest configuration with three projects:
 * - Unit tests: Run with jsdom environment
 * - Server tests: Run with node environment
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
      globals: true,
      exclude: ["node_modules", "e2e"],
      hookTimeout: 60000,
      testTimeout: 60000,
      ...(isRalphRunning && {
        reporter: ["dot"],
        silent: "passed-only",
      }),
      projects: [
        // Frontend unit tests with jsdom
        {
          extends: true,
          test: {
            name: "ui",
            environment: "jsdom",
            globals: true,
            setupFiles: ["./src/vitest-setup.ts"],
            exclude: ["node_modules", "e2e", "server/**/*.test.ts"],
            include: ["src/**/*.test.{ts,tsx}"],
            hookTimeout: 60000,
            testTimeout: 60000,
          },
        },
        // Server unit tests with node environment (no jsdom setup)
        {
          extends: true,
          test: {
            name: "server",
            environment: "node",
            globals: true,
            exclude: ["node_modules", "e2e"],
            include: ["server/**/*.test.ts"],
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
