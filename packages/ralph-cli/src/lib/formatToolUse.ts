import chalk from "chalk"

/**  Format a tool use block as a string */
export const formatToolUse = (
  /** The name of the tool */
  name: string,
  /** Optional argument for the tool */
  arg?: string,
): string => {
  const formattedName = chalk.blue(name)
  if (arg) {
    return `  ${formattedName} ${chalk.dim(arg)}`
  }
  return `  ${formattedName}`
}
