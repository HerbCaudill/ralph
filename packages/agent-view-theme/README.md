# @herbcaudill/agent-view-theme

VS Code theme parsing, CSS variable mapping, and Shiki syntax highlighting for `@herbcaudill/agent-view`.

## Install

```bash
npm install @herbcaudill/agent-view-theme
```

## Usage

### Parse a VS Code theme

```ts
import { parseThemeJson, parseThemeObject } from "@herbcaudill/agent-view-theme"

// From JSON string
const result = parseThemeJson(jsonString)
if (result.success) {
  console.log(result.theme) // VSCodeTheme
}

// From object
const result = parseThemeObject(themeData)
```

### Map theme to CSS variables

```ts
import { mapThemeToCSSVariables } from "@herbcaudill/agent-view-theme"

const cssVars = mapThemeToCSSVariables(theme)
// { "--background": "#1e1e1e", "--foreground": "#d4d4d4", ... }
```

### Apply theme to a DOM element

```ts
import { applyThemeToElement } from "@herbcaudill/agent-view-theme"

applyThemeToElement(document.body, theme)
```

### Create a full app theme

```ts
import { createAppTheme } from "@herbcaudill/agent-view-theme"

const appTheme = createAppTheme(vsCodeTheme, customStatusColors)
// { meta, cssVariables, statusColors }
```

### Syntax highlighting with Shiki

```ts
import { highlight, loadTheme, getHighlighter } from "@herbcaudill/agent-view-theme"

// Load a VS Code theme for highlighting
await loadTheme(vsCodeTheme, "my-theme")

// Highlight code
const html = await highlight("const x = 1", "typescript")
```

### Theme detection

```ts
import { isDarkTheme, isLightTheme } from "@herbcaudill/agent-view-theme"

isDarkTheme(theme) // true for dark themes
isLightTheme(theme) // true for light themes
```

## API

### Parser

- `parseThemeJson(json)` - Parse theme from JSON string
- `parseThemeObject(obj)` - Parse theme from object
- `validateThemeObject(obj)` - Validate without parsing
- `isDarkTheme(theme)` / `isLightTheme(theme)` - Theme type detection
- `getColor(theme, scope)` - Get a color from theme
- `getEssentialColors(theme)` - Get foreground/background/editor colors

### Mapper

- `mapThemeToCSSVariables(theme)` - Map theme to CSS custom properties
- `createAppTheme(theme, statusColors?)` - Create full AppTheme
- `generateThemeCSS(theme)` - Generate CSS string
- `applyThemeToElement(el, theme)` - Apply CSS variables to element
- `extractStatusColors(theme)` - Extract status colors from theme

### Highlighter

- `highlight(code, language, theme?)` - Highlight code to HTML
- `loadTheme(theme, name)` - Load a VS Code theme into Shiki
- `getHighlighter()` - Get the singleton Shiki highlighter
- `isLanguageSupported(lang)` - Check language support
- `getSupportedLanguages()` - List supported languages
- `normalizeLanguage(lang)` - Normalize language identifiers

### Types

- `VSCodeTheme` - Parsed VS Code theme
- `AppTheme` - Full application theme with CSS variables and status colors
- `StatusColors` - Status color definitions
- `CSSVariables` - CSS variable map
