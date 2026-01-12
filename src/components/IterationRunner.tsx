import React, { useState, useEffect } from "react"
import { Box, Text, useApp } from "ink"
import { spawn } from "child_process"
import { appendFileSync, writeFileSync } from "fs"
import { join } from "path"
import { EventDisplay } from "./EventDisplay.js"

const logFile = join(process.cwd(), ".ralph", "events.log")

export const IterationRunner = ({ totalIterations }: Props) => {
  const { exit } = useApp()
  const [currentIteration, setCurrentIteration] = useState(1)
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (currentIteration > totalIterations) {
      exit()
      return
    }

    // Clear log file at start of each iteration
    writeFileSync(logFile, "")
    setEvents([])
    setOutput("")

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

    let fullOutput = ""
    let stdoutEnded = false
    let closeInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null

    const handleIterationComplete = () => {
      if (!stdoutEnded || !closeInfo) return

      const { code, signal } = closeInfo
      if (code !== 0) {
        setError(
          `Claude exited with code ${code}${signal ? ` (signal: ${signal})` : ""}\n\nLast 2000 chars:\n${fullOutput.slice(-2000)}`,
        )
        setTimeout(() => {
          exit()
          process.exit(1)
        }, 100)
        return
      }

      if (fullOutput.includes("<promise>COMPLETE</promise>")) {
        exit()
        process.exit(0)
        return
      }

      // Move to next iteration
      setTimeout(() => setCurrentIteration(i => i + 1), 500)
    }

    child.stdout.on("data", data => {
      const chunk = data.toString()
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          appendFileSync(logFile, JSON.stringify(event, null, 2) + "\n\n")
          setEvents(prev => [...prev, event])
        } catch {
          // Incomplete JSON line, ignore
        }
      }
      fullOutput += chunk
      setOutput(fullOutput)
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
      setError(`Error running Claude: ${error.message}`)
      setTimeout(() => {
        exit()
        process.exit(1)
      }, 100)
    })

    return () => {
      child.kill()
    }
  }, [currentIteration, totalIterations, exit])

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan">Iteration {currentIteration}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>{"─".repeat(40)}</Text>
      </Box>
      <EventDisplay events={events} />
    </Box>
  )
}

type Props = {
  totalIterations: number
}
