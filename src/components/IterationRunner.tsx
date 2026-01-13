import React, { useState, useEffect } from "react"
import { Box, Text, useApp } from "ink"
import Spinner from "ink-spinner"
import SelectInput from "ink-select-input"
import { spawn, execSync } from "child_process"
import { appendFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { EventDisplay } from "./EventDisplay.js"

const logFile = join(process.cwd(), ".ralph", "events.log")
const ralphDir = join(process.cwd(), ".ralph")

const checkRequiredFiles = (): { missing: string[]; exists: boolean } => {
  const requiredFiles = ["prompt.md", "todo.md", "progress.md"]
  const missing = requiredFiles.filter(file => !existsSync(join(ralphDir, file)))
  return { missing, exists: missing.length === 0 }
}

export const IterationRunner = ({ totalIterations }: Props) => {
  const { exit } = useApp()
  const [currentIteration, setCurrentIteration] = useState(1)
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string>()
  const [needsInit, setNeedsInit] = useState<string[] | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  // Only use input handling if stdin supports raw mode
  const stdinSupportsRawMode = process.stdin.isTTY === true

  const handleInitSelection = (item: { value: string }) => {
    if (item.value === "yes") {
      setInitializing(true)
      try {
        // Run ralph init in a separate process
        execSync("pnpm ralph init", { stdio: "inherit" })
        setTimeout(() => {
          exit()
          process.exit(0)
        }, 100)
      } catch (err) {
        setError(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`)
        setTimeout(() => {
          exit()
          process.exit(1)
        }, 100)
      }
    } else {
      setTimeout(() => {
        exit()
        process.exit(1)
      }, 100)
    }
  }

  useEffect(() => {
    if (currentIteration > totalIterations) {
      exit()
      return
    }

    // Check if required files exist
    const { missing, exists } = checkRequiredFiles()
    if (!exists) {
      setNeedsInit(missing)
      // If stdin doesn't support raw mode, exit after showing the message
      if (!stdinSupportsRawMode) {
        setTimeout(() => {
          exit()
          process.exit(1)
        }, 100)
      }
      return
    }

    // Ensure .ralph directory exists and clear log file at start of each iteration
    mkdirSync(dirname(logFile), { recursive: true })
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
      {
        stdio: ["inherit", "pipe", "inherit"],
        env: {
          ...process.env,
          // Disable LSP plugins to avoid crashes when TypeScript LSP server errors
          ENABLE_LSP_TOOL: "0",
        },
      },
    )
    setIsRunning(true)

    let fullOutput = ""
    let stdoutEnded = false
    let closeInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null

    const handleIterationComplete = () => {
      if (!stdoutEnded || !closeInfo) return
      setIsRunning(false)

      const { code, signal } = closeInfo
      if (code !== 0) {
        setError(
          `Claude exited with code ${code}${
            signal ? ` (signal: ${signal})` : ""
          }\n\nLast 2000 chars:\n${fullOutput.slice(-2000)}`,
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

  if (needsInit) {
    if (initializing) {
      return (
        <Box flexDirection="column" paddingY={1}>
          <Text color="cyan">Initializing ralph...</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="yellow">Missing required files in .ralph directory:</Text>
        <Box flexDirection="column" paddingLeft={2} paddingY={1}>
          {needsInit.map(file => (
            <Text key={file} dimColor>
              • {file}
            </Text>
          ))}
        </Box>
        <Box marginTop={1}>
          {stdinSupportsRawMode ?
            <>
              <Text>Initialize now?</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: "Yes, initialize the project", value: "yes" },
                    { label: "No, exit", value: "no" },
                  ]}
                  onSelect={handleInitSelection}
                />
              </Box>
            </>
          : <Text>
              Run <Text color="cyan">ralph init</Text> to initialize the project.
            </Text>
          }
        </Box>
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1} marginBottom={1}>
        <Text color="cyan">Iteration {currentIteration}</Text>
      </Box>
      <EventDisplay events={events} />
      {isRunning && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
        </Box>
      )}
    </Box>
  )
}

type Props = {
  totalIterations: number
}
