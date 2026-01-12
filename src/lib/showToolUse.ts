import chalk from "chalk"
import { flushLine, resetTextState } from "./textFormatting.js"
import { outputState } from "./outputState.js"

const toolIndent = "  "

export const showToolUse = (name: string, arg?: string) => {
  flushLine()
  while (outputState.trailingNewlines < 2) {
    process.stdout.write("\n")
    outputState.trailingNewlines++
  }
  const formatted = arg ? `${chalk.blue(name)} ${chalk.dim(arg)}` : chalk.blue(name)
  console.log(toolIndent + formatted)
  outputState.trailingNewlines = 1
  resetTextState()
  outputState.needsBlankLineBeforeText = true
}
