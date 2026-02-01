import { getLuminance } from "./getLuminance"

/** Get a readable foreground color (black or white) for a background color. */
export function getContrastingColor(
  /** Background color hex string. */
  backgroundColor: string,
): string {
  const luminance = getLuminance(backgroundColor)
  return luminance > 0.4 ? "#000000" : "#ffffff"
}
