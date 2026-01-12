import chalk from "chalk"
import { readFileSync } from "fs"
import { processEvent } from "./processEvent.js"

export const replayLog = (filePath: string) => {
  console.log(chalk.cyan(`Replaying: ${filePath}`))
  console.log(chalk.dim("─".repeat(40)) + "\n")

  const content = readFileSync(filePath, "utf-8")
  // Log file contains pretty-printed JSON objects separated by blank lines
  const eventStrings = content.split(/\n\n+/).filter(s => s.trim())

  for (const eventStr of eventStrings) {
    try {
      const event = JSON.parse(eventStr)
      processEvent(event)
    } catch {
      // Skip malformed entries
    }
  }
  console.log("\n")
}
