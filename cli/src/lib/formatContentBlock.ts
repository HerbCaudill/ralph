import chalk from "chalk"
import type { ContentBlock } from "../components/eventToBlocks.js"
import { formatText } from "./formatText.js"
import { formatToolUse } from "./formatToolUse.js"
import { formatUserMessage } from "./formatUserMessage.js"

/**
 * Convert a content block to formatted string lines
 */
export const formatContentBlock = (block: ContentBlock): string[] => {
  if (block.type === "text") {
    const formatted = formatText(block.content)
    // Split into lines, preserving empty lines for paragraph breaks
    return formatted.split("\n")
  }

  if (block.type === "user") {
    return [formatUserMessage(block.content)]
  }

  return [formatToolUse(block.name, block.arg)]
}

/**
 * Format a round header
 */
export const formatIterationHeader = (iteration: number): string => {
  return chalk.cyan.bold(`─── Round ${iteration} ───`)
}
