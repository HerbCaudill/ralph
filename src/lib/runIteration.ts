import chalk from "chalk"
import { spawn } from "child_process"
import { appendFileSync, writeFileSync } from "fs"
import { join } from "path"
import { processEvent } from "./processEvent.js"
import { flushLine, resetTextState } from "./textFormatting.js"

const logFile = join(process.cwd(), ".ralph", "events.log")

export const runIteration = (i: number, iterations: number) => {
  if (i > iterations) {
    console.log(chalk.green(`Completed ${iterations} iterations.`))
    return
  }

  console.log(chalk.cyan(`\nIteration ${i}`))
  console.log(chalk.dim("─".repeat(40)) + "\n")

  // Clear log file at start of each iteration
  writeFileSync(logFile, "")

  const child = spawn(
    "claude",
    [
      "--permission-mode",
      "bypassPermissions",
      "-p",
      "@.ralph/prompt.md",
      "@.ralph/todo.md",
      "@.ralph/progress.md",
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
    ],
    { stdio: ["inherit", "pipe", "inherit"] },
  )

  let output = ""

  let stdoutEnded = false
  let closeInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null

  const handleIterationComplete = () => {
    if (!stdoutEnded || !closeInfo) return

    const { code, signal } = closeInfo
    if (code !== 0) {
      console.error(
        chalk.red(`Claude exited with code ${code}${signal ? ` (signal: ${signal})` : ""}`),
      )
      console.error(chalk.yellow("Last 2000 chars of output:"))
      console.error(chalk.dim(output.slice(-2000)))
      process.exit(1)
    }

    if (output.includes("<promise>COMPLETE</promise>")) {
      console.log(chalk.green("Todo list complete, exiting."))
      process.exit(0)
    }

    // Flush any remaining text in the line buffer and reset state
    flushLine()
    resetTextState()
    console.log("\n") // Add blank lines before next iteration

    runIteration(i + 1, iterations)
  }

  child.stdout.on("data", data => {
    const chunk = data.toString()
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        appendFileSync(logFile, JSON.stringify(event, null, 2) + "\n\n")
        processEvent(event)
      } catch {
        // Incomplete JSON line, ignore
      }
    }
    output += chunk
  })

  child.stdout.on("end", () => {
    stdoutEnded = true
    handleIterationComplete()
  })

  child.on("close", (code, signal) => {
    closeInfo = { code, signal }
    handleIterationComplete()
  })

  child.on("error", error => {
    console.error(chalk.red("Error running Claude:"), error)
    process.exit(1)
  })
}
