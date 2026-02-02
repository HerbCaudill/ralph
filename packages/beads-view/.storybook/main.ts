import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: config => {
    // Add Tailwind v4 Vite plugin to process CSS
    if (!config.plugins) config.plugins = []
    config.plugins.push(tailwindcss())
    return config
  },
}

export default config
