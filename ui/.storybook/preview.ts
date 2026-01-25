import type { Preview } from "@storybook/react-vite"
import React from "react"
import { TestProviders } from "../src/components/TestProviders"
import { mapThemeToCSSVariables } from "../src/lib/theme"
import { storybookThemes, getTheme, defaultThemeId } from "./themeLoader"
import { StorybookThemeProvider } from "./StorybookThemeProvider"
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

      // Compute CSS variables from the theme upfront so they're available during initial render
      // This ensures text-foreground and other color classes work correctly from the start
      const themeCssVars = themeData ? mapThemeToCSSVariables(themeData.theme) : {}

      // Build the inline style object with theme variables and repo accent
      const style = {
        ...themeCssVars,
        "--repo-accent": "#0d9488",
        "--repo-accent-foreground": "#ffffff",
      } as React.CSSProperties

      // If no theme data, render without the provider
      if (!themeData) {
        return React.createElement(
          TestProviders,
          null,
          React.createElement(
            "div",
            {
              className: `${isDark ? "dark" : ""} bg-background text-foreground min-h-screen p-10`,
              style,
            },
            React.createElement(Story),
          ),
        )
      }

      return React.createElement(
        TestProviders,
        null,
        React.createElement(
          StorybookThemeProvider,
          { theme: themeData },
          React.createElement(
            "div",
            {
              className: `${isDark ? "dark" : ""} bg-background text-foreground min-h-screen p-10`,
              style,
            },
            React.createElement(Story),
          ),
        ),
      )
    },
  ],
}

export default preview
