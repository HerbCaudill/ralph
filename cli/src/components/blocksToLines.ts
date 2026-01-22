import type { ContentBlock } from "./eventToBlocks.js"
import { formatContentBlock } from "../lib/formatContentBlock.js"

/**
 * Convert content blocks to lines of formatted text.
 */
export const blocksToLines = (
  /** Content blocks to convert */
  blocks: ContentBlock[],
): string[] => {
  const lines: string[] = []
  for (const block of blocks) {
    const blockLines = formatContentBlock(block)
    lines.push(...blockLines)
    // Add blank line after each block
    lines.push("")
  }
  return lines
}
