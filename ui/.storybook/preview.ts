import type { Preview } from "@storybook/react-vite"
import React from "react"
import { TestProviders } from "../src/components/TestProviders"
import "../src/index.css"
import { mapThemeToCSSVariables } from "../src/lib/theme"
import { cn } from "../src/lib/utils"
import { StorybookThemeProvider } from "./StorybookThemeProvider"
import { defaultThemeId, getTheme, storybookThemes } from "./themeLoader"

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
        "--repo-accent": "#ff0000",
        "--repo-accent-foreground": "#ffffff",
      } as React.CSSProperties

      // Extract the common story content
      const storyContent = React.createElement(
        "div",
        {
          className: cn("bg-background text-foreground min-h-screen p-10", isDark && "dark"),
          style,
        },
        React.createElement(Story),
      )

      // Conditionally wrap with StorybookThemeProvider if theme data exists

      return React.createElement(
        TestProviders,
        null,
        themeData ?
          React.createElement(StorybookThemeProvider, { theme: themeData, children: storyContent })
        : storyContent,
      )
    },
  ],
}

export default preview
