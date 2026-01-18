import chalk from "chalk"
import type { ContentBlock } from "../components/eventToBlocks.js"

/**
 * Format a text string with markdown-style formatting (bold and inline code)
 */
const formatText = (content: string): string => {
  let result = ""
  let i = 0
  let inBold = false
  let inCode = false

  while (i < content.length) {
    if (content[i] === "*" && content[i + 1] === "*") {
      inBold = !inBold
      i += 2
    } else if (content[i] === "`") {
      inCode = !inCode
      i++
    } else {
      let char = content[i]

      if (inCode) {
        char = chalk.yellow(char)
      } else if (inBold) {
        char = chalk.bold(char)
      }

      result += char
      i++
    }
  }

  return result
}

/**
 * Format a tool use block as a string
 */
const formatToolUse = (name: string, arg?: string): string => {
  const formattedName = chalk.blue(name)
  if (arg) {
    return `  ${formattedName} ${chalk.dim(arg)}`
  }
  return `  ${formattedName}`
}

/**
 * Format a user message
 */
const formatUserMessage = (content: string): string => {
  return chalk.green(`📨 You: ${content}`)
}

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
