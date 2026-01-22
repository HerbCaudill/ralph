import chalk from "chalk"

/**
 * Format a text string with markdown-style formatting (bold and inline code)
 */
export const formatText = (
  /** The content to format */
  content: string,
): string => {
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
