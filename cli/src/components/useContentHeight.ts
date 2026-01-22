import { useTerminalSize } from "../lib/useTerminalSize.js"

/**
 * BigText "tiny" font takes 4 rows, plus 1 for separator
 */
export const HEADER_HEIGHT = 5

/**
 * Separator plus content row
 */
export const FOOTER_HEIGHT = 2

/**
 * Top and bottom borders
 */
const BORDER_HEIGHT = 2

/**
 * Calculate the available content height based on terminal size
 */
export const useContentHeight = (
  /** Whether the layout includes a footer */
  hasFooter: boolean = true,
): number => {
  const { rows } = useTerminalSize()
  const footerHeight = hasFooter ? FOOTER_HEIGHT : 0
  return Math.max(1, rows - HEADER_HEIGHT - footerHeight - BORDER_HEIGHT)
}
