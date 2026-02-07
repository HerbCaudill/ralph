import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      /** Unit tests with jsdom. */
      {
        extends: true,
        test: {
          name: "unit",
          globals: false,
          environment: "jsdom",
          setupFiles: ["./src/vitest-setup.ts"],
        },
      },
      /** Storybook interaction tests in a real browser via Playwright. */
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
})
