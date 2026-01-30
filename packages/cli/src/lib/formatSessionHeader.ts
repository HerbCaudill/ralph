import chalk from "chalk"

/**  Format a round header */
export const formatSessionHeader = (
  /** Session number to display */
  session: number,
): string => {
  return chalk.cyan.bold(`─── Round ${session} ───`)
}
