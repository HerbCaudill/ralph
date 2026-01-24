import type { Preview } from "@storybook/react-vite"
import React from "react"
import { TestProviders } from "../src/components/TestProviders"
import { applyThemeToElement } from "../src/lib/theme"
import { storybookThemes, getTheme, defaultThemeId } from "./themeLoader"
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
      description: "VS Code theme for components",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: storybookThemes.map(t => ({
          value: t.id,
          title: t.name,
          icon: t.isDark ? "moon" : "sun",
        })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: defaultThemeId,
  },
  decorators: [
    (Story, context) => {
      const themeId = context.globals.theme || defaultThemeId
      const themeData = getTheme(themeId)
      const isDark = themeData?.isDark ?? false

      // Create a ref callback to apply CSS variables
      const applyTheme = (element: HTMLDivElement | null) => {
        if (element && themeData) {
          applyThemeToElement(element, themeData.theme)
        }
      }

      return React.createElement(
        TestProviders,
        null,
        React.createElement(
          "div",
          {
            ref: applyTheme,
            className: `${isDark ? "dark" : ""} bg-background text-foreground min-h-screen p-10`,
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
