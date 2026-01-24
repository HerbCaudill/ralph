import chalk from "chalk"

/**  Format a round header */
export const formatIterationHeader = (
  /** Iteration number to display */
  iteration: number,
): string => {
  return chalk.cyan.bold(`─── Round ${iteration} ───`)
}
