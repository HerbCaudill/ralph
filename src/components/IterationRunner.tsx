import React, { useState, useEffect, useRef } from "react"
import { Box, Text, useApp } from "ink"
import Spinner from "ink-spinner"
import SelectInput from "ink-select-input"
import { execSync } from "child_process"
import { appendFileSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { EventDisplay } from "./EventDisplay.js"
import { FullScreenLayout, useContentHeight } from "./FullScreenLayout.js"

const logFile = join(process.cwd(), ".ralph", "events.log")
const ralphDir = join(process.cwd(), ".ralph")
const promptFile = join(ralphDir, "prompt.md")
const todoFile = join(ralphDir, "todo.md")

const checkRequiredFiles = (): { missing: string[]; exists: boolean } => {
  const requiredFiles = ["prompt.md", "todo.md"]
  const missing = requiredFiles.filter(file => !existsSync(join(ralphDir, file)))
  return { missing, exists: missing.length === 0 }
}

// Convert SDK message to event format for display
const sdkMessageToEvent = (message: SDKMessage): Record<string, unknown> | null => {
  // Pass through messages that have the structure we expect
  if (message.type === "assistant" || message.type === "user" || message.type === "result") {
    return message as unknown as Record<string, unknown>
  }
  // Skip system and stream_event messages for display
  return null
}

type IterationEvents = {
  iteration: number
  events: Array<Record<string, unknown>>
}

export const IterationRunner = ({ totalIterations, claudeVersion, ralphVersion }: Props) => {
  const { exit } = useApp()
  const [currentIteration, setCurrentIteration] = useState(1)
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const eventsRef = useRef<Array<Record<string, unknown>>>([])
  const [completedIterations, setCompletedIterations] = useState<IterationEvents[]>([])
  const [error, setError] = useState<string>()
  const [needsInit, setNeedsInit] = useState<string[] | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  // Hook must be called before any conditional returns
  const contentHeight = useContentHeight(true)

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

  // Keep ref in sync with events state for access in callbacks
  useEffect(() => {
    eventsRef.current = events
  }, [events])

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

    // Read prompt and todo files
    const promptContent = readFileSync(promptFile, "utf-8")
    const todoContent = readFileSync(todoFile, "utf-8")
    const fullPrompt = `${promptContent}\n\n## Current Todo List\n\n${todoContent}`

    const abortController = new AbortController()
    setIsRunning(true)

    const runQuery = async () => {
      let finalResult = ""

      try {
        for await (const message of query({
          prompt: fullPrompt,
          options: {
            abortController,
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            includePartialMessages: true,
            env: {
              ...process.env,
              // Disable LSP plugins to avoid crashes when TypeScript LSP server errors
              ENABLE_LSP_TOOL: "0",
            },
          },
        })) {
          // Log raw message to file
          appendFileSync(logFile, JSON.stringify(message, null, 2) + "\n\n")

          // Convert to event format for display
          const event = sdkMessageToEvent(message)
          if (event) {
            setEvents(prev => [...prev, event])
          }

          // Capture the final result message
          if (
            message.type === "result" &&
            "result" in message &&
            typeof message.result === "string"
          ) {
            finalResult = message.result
          }
        }

        setIsRunning(false)

        // Check for completion
        if (finalResult.includes("<promise>COMPLETE</promise>")) {
          exit()
          process.exit(0)
          return
        }

        // Save current events and move to next iteration
        const currentEvents = eventsRef.current
        setCompletedIterations(prev => [
          ...prev,
          { iteration: currentIteration, events: currentEvents },
        ])
        setTimeout(() => setCurrentIteration(i => i + 1), 500)
      } catch (err) {
        setIsRunning(false)
        if (abortController.signal.aborted) {
          return // Intentionally aborted
        }
        setError(`Error running Claude: ${err instanceof Error ? err.message : String(err)}`)
        setTimeout(() => {
          exit()
          process.exit(1)
        }, 100)
      }
    }

    runQuery()

    return () => {
      abortController.abort()
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

  const footer =
    isRunning ?
      <Text color="cyan">
        <Spinner type="dots" /> Running iteration {currentIteration} (max {totalIterations})
      </Text>
    : <Text dimColor>Ready</Text>

  const version = `@herbcaudill/ralph v${ralphVersion} • Claude Code v${claudeVersion}`

  return (
    <FullScreenLayout title="Ralph" footer={footer} version={version}>
      <EventDisplay
        events={events}
        iteration={currentIteration}
        completedIterations={completedIterations}
        height={contentHeight}
      />
    </FullScreenLayout>
  )
}

type Props = {
  totalIterations: number
  claudeVersion: string
  ralphVersion: string
}
