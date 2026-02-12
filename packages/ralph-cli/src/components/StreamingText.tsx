import React from "react"
import { Text } from "ink"
import chalk from "chalk"

/**
 * Process markdown formatting: **bold** and `code`. Build a single string with
 * chalk formatting to avoid Ink treating multiple Text components as separate blocks.
 */
export const StreamingText = ({ content }: Props) => {
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

      // Apply formatting
      if (inCode) {
        char = chalk.yellow(char)
      } else if (inBold) {
        char = chalk.bold(char)
      }

      result += char
      i++
    }
  }

  return <Text>{result}</Text>
}

type Props = {
  content: string
}
