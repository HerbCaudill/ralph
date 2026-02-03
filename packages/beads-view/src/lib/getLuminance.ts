/** Calculate relative luminance of a hex color for WCAG contrast calculations. */
export function getLuminance(
  /** Hex color string (with or without leading #). */
  hex: string,
): number {
  const color = hex.replace("#", "")
  const r = parseInt(color.slice(0, 2), 16) / 255
  const g = parseInt(color.slice(2, 4), 16) / 255
  const b = parseInt(color.slice(4, 6), 16) / 255

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}
