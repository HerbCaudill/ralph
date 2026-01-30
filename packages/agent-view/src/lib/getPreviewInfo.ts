import { TOOL_OUTPUT_PREVIEW_LINES } from "../constants"

/**  Extract a preview of content and calculate how many lines are hidden. */
export function getPreviewInfo(
  /** The full content string to preview */
  content: string,
): { preview: string; remainingLines: number } {
  const lines = content.split("\n")
  if (lines.length <= TOOL_OUTPUT_PREVIEW_LINES) {
    return { preview: content, remainingLines: 0 }
  }
  return {
    preview: lines.slice(0, TOOL_OUTPUT_PREVIEW_LINES).join("\n"),
    remainingLines: lines.length - TOOL_OUTPUT_PREVIEW_LINES,
  }
}
