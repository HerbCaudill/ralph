import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: config => {
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
