/**
 * Calculate relative luminance of a color for WCAG contrast calculations.
 * Returns a value between 0 (black) and 1 (white).
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const color = hex.replace("#", "")
  const r = parseInt(color.slice(0, 2), 16) / 255
  const g = parseInt(color.slice(2, 4), 16) / 255
  const b = parseInt(color.slice(4, 6), 16) / 255

  // sRGB to linear RGB
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Get an appropriate foreground color (black or white) for a given background color.
 * Uses WCAG luminance calculation to ensure readable contrast.
 */
export function getContrastingColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor)
  // Use white text for dark backgrounds, black text for light backgrounds
  return luminance > 0.4 ? "#000000" : "#ffffff"
}
