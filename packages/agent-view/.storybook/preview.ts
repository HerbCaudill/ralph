import type { Preview } from "@storybook/react-vite"
import React from "react"
import { AgentViewProvider } from "../src/context/AgentViewProvider"
import { mapThemeToCSSVariables } from "@herbcaudill/agent-view-theme"
import { loadTheme } from "@herbcaudill/agent-view-theme"
import "./app.css"
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
        order: ["Primitives", "Content", "Feedback", "Collections"],
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

      const themeCssVars = themeData ? mapThemeToCSSVariables(themeData.theme) : {}

      const style = {
        ...themeCssVars,
        "--repo-accent": "#14b8a6",
        "--repo-accent-foreground": "#ffffff",
      } as React.CSSProperties

      // Load Shiki theme for syntax highlighting
      if (themeData) {
        loadTheme(themeData.theme, themeData.id)
      }

      return React.createElement(
        AgentViewProvider,
        { value: { isDark, toolOutput: { showOutput: true } } },
        React.createElement(
          "div",
          {
            className: `bg-background text-foreground min-h-screen p-10${isDark ? " dark" : ""}`,
            style,
          },
          React.createElement(Story),
        ),
      )
    },
  ],
}

export default preview
