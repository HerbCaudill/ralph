import type { StorybookConfig } from "@storybook/react-vite"
import { createLogger } from "vite"

/**
 * Custom logger that filters out proxy errors during tests.
 * These errors occur when Storybook tests run without a backend server.
 */
const logger = createLogger()
const originalError = logger.error.bind(logger)
const originalWarn = logger.warn.bind(logger)
logger.error = (msg, options) => {
  if (typeof msg === "string") {
    if (msg.includes("ws proxy error") || msg.includes("ws proxy")) return
    if (msg.includes("http proxy error")) return
  }
  originalError(msg, options)
}
logger.warn = (msg, options) => {
  if (typeof msg === "string") {
    if (msg.includes("http proxy error")) return
  }
  originalWarn(msg, options)
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Serve static files from .storybook/fixtures at /fixtures
  // Used by withImportedState decorator to load state files for debugging
  staticDirs: [{ from: "./fixtures", to: "/fixtures" }],
  viteFinal: config => {
    // Use custom logger to suppress proxy errors during tests
    config.customLogger = logger

    // Remove proxy config - Storybook tests don't need backend API
    if (config.server) {
      delete config.server.proxy
    }

    // Remove PWA plugin which doesn't work with Storybook builds
    config.plugins = config.plugins?.filter(plugin => {
      if (!plugin) return true
      if (Array.isArray(plugin)) {
        // Filter out any nested PWA plugins
        return !plugin.some(
          p => p && typeof p === "object" && "name" in p && String(p.name).includes("pwa"),
        )
      }
      if (typeof plugin === "object" && "name" in plugin) {
        return !String(plugin.name).toLowerCase().includes("pwa")
      }
      return true
    })
    return config
  },
}

export default config
