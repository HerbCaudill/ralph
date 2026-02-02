import type { Preview } from "@storybook/react-vite"
import React from "react"
import { TestProviders } from "../src/components/TestProviders"
import "../src/index.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disabled: true,
    },
    layout: "fullscreen",
  },
  decorators: [
    Story => {
      // Build the inline style object with repo accent color
      const style = {
        "--repo-accent": "#14b8a6",
        "--repo-accent-foreground": "#ffffff",
      } as React.CSSProperties

      // Wrap story with proper background and text colors
      const storyContent = React.createElement(
        "div",
        {
          className: "bg-background text-foreground min-h-screen p-10",
          style,
        },
        React.createElement(Story),
      )

      return React.createElement(TestProviders, null, storyContent)
    },
  ],
}

export default preview
