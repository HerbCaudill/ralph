import chalk from "chalk"

/**
 * Format a user message
 */
export const formatUserMessage = (
  /** The message content to format */
  content: string,
): string => {
  return chalk.green(content)
}
