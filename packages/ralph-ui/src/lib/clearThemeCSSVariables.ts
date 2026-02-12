/** All CSS variable names that the theme system may set on the document root. */
const THEME_CSS_VARIABLES = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--input-placeholder",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--status-success",
  "--status-warning",
  "--status-error",
  "--status-info",
  "--status-neutral",
]

/**
 * Remove all theme CSS variables from a DOM element,
 * reverting to stylesheet defaults.
 */
export function clearThemeCSSVariables(
  /** The DOM element to clear CSS variables from */
  element: HTMLElement,
): void {
  for (const name of THEME_CSS_VARIABLES) {
    element.style.removeProperty(name)
  }
}
