import type { CSSVariables } from "@herbcaudill/agent-view-theme"

/**
 * Apply a set of CSS variables to a DOM element.
 * Used to apply VS Code theme colors to the document root.
 */
export function applyThemeCSSVariables(
  /** The DOM element to apply CSS variables to */
  element: HTMLElement,
  /** The CSS variables to apply */
  cssVariables: CSSVariables,
): void {
  for (const [name, value] of Object.entries(cssVariables)) {
    element.style.setProperty(name, value)
  }
}
