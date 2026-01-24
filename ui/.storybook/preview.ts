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
    options: {
      storySort: {
        order: [
          "Primitives",
          "Content",
          "Feedback",
          "Inputs",
          "Indicators",
          "Selectors",
          "Collections",
          "Dialogs",
          "Panels",
          "Layout",
          "Pages",
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: "Theme for components",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || "light"
      return React.createElement(
        TestProviders,
        null,
        React.createElement(
          "div",
          {
            className: `${theme === "dark" ? "dark" : ""} bg-background text-foreground min-h-screen p-4`,
            style: {
              "--repo-accent": "#0d9488",
              "--repo-accent-foreground": "#ffffff",
            } as React.CSSProperties,
          },
          React.createElement(Story),
        ),
      )
    },
  ],
}

export default preview
