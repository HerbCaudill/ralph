import React, { useState, useEffect, useRef } from "react"
import { Box, Text, useApp, Static, useInput } from "ink"
import Spinner from "ink-spinner"
import BigText from "ink-big-text"
import Gradient from "ink-gradient"
import { EnhancedTextInput } from "./EnhancedTextInput.js"
import SelectInput from "ink-select-input"
import { execSync } from "child_process"
import { appendFileSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { Header } from "./Header.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"
import { formatContentBlock } from "../lib/formatContentBlock.js"
import { addTodo } from "../lib/addTodo.js"
import { getProgress, getInitialBeadsCount, type ProgressData } from "../lib/getProgress.js"
import { ProgressBar } from "./ProgressBar.js"
import { watchForNewIssues, BeadsClient, type MutationEvent } from "../lib/beadsClient.js"
import { MessageQueue, createUserMessage } from "../lib/MessageQueue.js"

const logFile = join(process.cwd(), ".ralph", "events.log")
const ralphDir = join(process.cwd(), ".ralph")
const promptFile = join(ralphDir, "prompt.md")
const todoFile = join(ralphDir, "todo.md")

const checkRequiredFiles = (): { missing: string[]; exists: boolean } => {
  const requiredFiles = ["prompt.md"]
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

// Process raw events into content blocks (moved from EventDisplay)
// With includePartialMessages: true, we receive multiple snapshots of the same message
// as it builds up. Each snapshot may contain different parts of the message content,
// so we need to merge them and deduplicate.
const processEvents = (events: Array<Record<string, unknown>>): ContentBlock[] => {
  const assistantEvents = events.filter(event => event.type === "assistant")

  // Collect all content blocks from all snapshots of the same message
  const messageMap = new Map<string, Array<Record<string, unknown>>>()
  for (const event of assistantEvents) {
    const message = event.message as Record<string, unknown> | undefined
    const messageId = message?.id as string | undefined
    const content = message?.content as Array<Record<string, unknown>> | undefined

    if (messageId && content) {
      if (!messageMap.has(messageId)) {
        messageMap.set(messageId, [])
      }
      messageMap.get(messageId)!.push(...content)
    }
  }

  // Create merged events with deduplicated content
  const mergedEvents = Array.from(messageMap.entries()).map(([messageId, allContent]) => {
    // Deduplicate content blocks by their ID (for tool_use) or text (for text blocks)
    const seenBlocks = new Set<string>()
    const uniqueContent: Array<Record<string, unknown>> = []

    for (const block of allContent) {
      const blockType = block.type as string
      let blockKey: string

      if (blockType === "tool_use") {
        // Tool use blocks are unique by their ID
        blockKey = `tool:${block.id}`
      } else if (blockType === "text") {
        // For text blocks, check if this is a prefix of or prefixed by existing text
        // This handles incremental text updates where each snapshot has more content
        const text = block.text as string
        let isDuplicate = false

        for (const seenKey of seenBlocks) {
          if (seenKey.startsWith("text:")) {
            const seenText = seenKey.substring(5)
            // If existing text starts with this text, or this text starts with existing,
            // keep only the longer one
            if (seenText.startsWith(text)) {
              // Existing is longer, this is a duplicate
              isDuplicate = true
              break
            } else if (text.startsWith(seenText)) {
              // This is longer, remove the old one and add this
              seenBlocks.delete(seenKey)
              // Also remove from uniqueContent
              const idx = uniqueContent.findIndex(b => b.type === "text" && b.text === seenText)
              if (idx >= 0) uniqueContent.splice(idx, 1)
              break
            }
          }
        }

        if (isDuplicate) continue
        blockKey = `text:${text}`
      } else {
        blockKey = JSON.stringify(block)
      }

      if (!seenBlocks.has(blockKey)) {
        seenBlocks.add(blockKey)
        uniqueContent.push(block)
      }
    }

    return {
      type: "assistant",
      message: {
        id: messageId,
        content: uniqueContent,
      },
    }
  })

  return mergedEvents.flatMap(event => eventToBlocks(event))
}

// Static item representing either header, iteration header, or content block
type StaticItem =
  | { type: "header"; claudeVersion: string; ralphVersion: string; key: string }
  | { type: "iteration"; iteration: number; key: string }
  | { type: "block"; block: ContentBlock; key: string }

export const IterationRunner = ({ totalIterations, claudeVersion, ralphVersion, watch }: Props) => {
  const { exit } = useApp()
  const [currentIteration, setCurrentIteration] = useState(1)
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const eventsRef = useRef<Array<Record<string, unknown>>>([])
  const [error, setError] = useState<string>()
  const [needsInit, setNeedsInit] = useState<string[] | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isAddingTodo, setIsAddingTodo] = useState(false)
  const [todoText, setTodoText] = useState("")
  const [todoMessage, setTodoMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [isAddingUserMessage, setIsAddingUserMessage] = useState(false)
  const [userMessageText, setUserMessageText] = useState("")
  const [userMessageStatus, setUserMessageStatus] = useState<{
    type: "success" | "error" | "pending"
    text: string
  } | null>(null)
  const [hasTodoFile, setHasTodoFile] = useState(false)
  const [initialBeadsCount] = useState(() => getInitialBeadsCount())
  const [progressData, setProgressData] = useState<ProgressData>(() =>
    getProgress(getInitialBeadsCount()),
  )
  const [isWatching, setIsWatching] = useState(false)
  const [detectedIssue, setDetectedIssue] = useState<MutationEvent | null>(null)
  const watchCleanupRef = useRef<(() => void) | null>(null)
  const [watchCycle, setWatchCycle] = useState(0) // Increments to force useEffect re-run

  // Track static items that have been rendered (for Ink's Static component)
  const [staticItems, setStaticItems] = useState<StaticItem[]>([
    { type: "header", claudeVersion, ralphVersion, key: "header" },
  ])
  const renderedBlocksRef = useRef<Set<string>>(new Set())
  const lastIterationRef = useRef<number>(0)
  // Message queue for sending user messages to Claude while running
  const messageQueueRef = useRef<MessageQueue | null>(null)

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

  // Handle Ctrl-T to add a new todo
  const handleTodoSubmit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      setIsAddingTodo(false)
      setTodoText("")
      return
    }

    try {
      addTodo(trimmed)
      setTodoMessage({ type: "success", text: "✅ added" })
      setTodoText("")
      setIsAddingTodo(false)
      // Clear success message after 2 seconds
      setTimeout(() => setTodoMessage(null), 2000)
    } catch (err) {
      setTodoMessage({
        type: "error",
        text: `Failed to add todo: ${err instanceof Error ? err.message : String(err)}`,
      })
      setTodoText("")
      setIsAddingTodo(false)
      // Clear error message after 5 seconds
      setTimeout(() => setTodoMessage(null), 5000)
    }
  }

  // Handle Ctrl+M to send a message to Claude
  const handleUserMessageSubmit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      setIsAddingUserMessage(false)
      setUserMessageText("")
      return
    }

    // Send the message to Claude via the SDK's streamInput
    if (messageQueueRef.current && isRunning) {
      const userMessage = createUserMessage(trimmed)
      messageQueueRef.current.push(userMessage)

      // Also add the user message to events for display
      const displayEvent = {
        type: "user",
        message: {
          id: `user-injected-${Date.now()}`,
          role: "user",
          content: [{ type: "text", text: trimmed }],
        },
      }
      setEvents(prev => [...prev, displayEvent])

      setUserMessageStatus({ type: "success", text: `📨 Sent: "${trimmed}"` })
    } else {
      setUserMessageStatus({
        type: "error",
        text: "Unable to send message - Claude is not running",
      })
    }

    setUserMessageText("")
    setIsAddingUserMessage(false)
    // Clear status message after 3 seconds
    setTimeout(() => setUserMessageStatus(null), 3000)
  }

  // Handle keyboard input for Ctrl-T (todo) and Ctrl-M (message)
  useInput(
    (input, key) => {
      // Ctrl-T to start adding a todo (only if todo.md exists)
      if (key.ctrl && input === "t" && hasTodoFile && !isAddingUserMessage) {
        setIsAddingTodo(true)
        setTodoText("")
        setTodoMessage(null)
      }
      // Ctrl-M to start adding a message to Claude (only while running)
      if (key.ctrl && input === "m" && isRunning && !isAddingTodo) {
        setIsAddingUserMessage(true)
        setUserMessageText("")
        setUserMessageStatus(null)
      }
      // Escape to cancel adding a todo or message
      if (key.escape && isAddingTodo) {
        setIsAddingTodo(false)
        setTodoText("")
      }
      if (key.escape && isAddingUserMessage) {
        setIsAddingUserMessage(false)
        setUserMessageText("")
      }
    },
    { isActive: stdinSupportsRawMode && !needsInit },
  )

  // Keep ref in sync with events state for access in callbacks
  useEffect(() => {
    eventsRef.current = events
  }, [events])

  // Update progress data when iteration changes or running stops
  useEffect(() => {
    if (!isRunning) {
      setProgressData(getProgress(initialBeadsCount))
    }
  }, [currentIteration, isRunning, initialBeadsCount])

  // Watch for new issues when in watch mode
  useEffect(() => {
    if (!isWatching) return

    // Start watching for new issues
    const cleanup = watchForNewIssues(issue => {
      setDetectedIssue(issue)
      // Brief pause to show the detected issue, then resume
      setTimeout(() => {
        setIsWatching(false)
        setDetectedIssue(null)
        // Reset rendered blocks for new cycle
        renderedBlocksRef.current.clear()
        // Increment round number when picking up new issue
        setCurrentIteration(i => i + 1)
        setWatchCycle(c => c + 1)
      }, 1500)
    })

    watchCleanupRef.current = cleanup

    return () => {
      cleanup()
      watchCleanupRef.current = null
    }
  }, [isWatching])

  // Convert events to static items as they arrive
  useEffect(() => {
    const newItems: StaticItem[] = []

    // Add iteration header if this is a new iteration
    if (currentIteration > lastIterationRef.current) {
      newItems.push({
        type: "iteration",
        iteration: currentIteration,
        key: `iteration-${currentIteration}`,
      })
      lastIterationRef.current = currentIteration
    }

    // Process current events into blocks
    const blocks = processEvents(events)

    // Add any new blocks that haven't been rendered yet
    for (const block of blocks) {
      // Use the block's ID which is generated from message ID + block index
      // This ensures the same logical block always has the same key
      const blockKey = block.id

      if (!renderedBlocksRef.current.has(blockKey)) {
        renderedBlocksRef.current.add(blockKey)
        newItems.push({ type: "block", block, key: blockKey })
      }
    }

    if (newItems.length > 0) {
      setStaticItems(prev => [...prev, ...newItems])
    }
  }, [events, currentIteration])

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

    // Read prompt and optional todo file
    const promptContent = readFileSync(promptFile, "utf-8")
    const todoExists = existsSync(todoFile)
    setHasTodoFile(todoExists)
    const todoContent = todoExists ? readFileSync(todoFile, "utf-8") : ""
    const fullPrompt =
      todoContent ? `${promptContent}\n\n## Current Todo List\n\n${todoContent}` : promptContent

    const abortController = new AbortController()
    setIsRunning(true)

    // Create a message queue for this iteration
    // This allows us to send user messages to Claude while it's running
    const messageQueue = new MessageQueue()
    messageQueueRef.current = messageQueue

    // Push the initial prompt as the first message
    messageQueue.push(createUserMessage(fullPrompt))

    const runQuery = async () => {
      let finalResult = ""

      try {
        for await (const message of query({
          prompt: messageQueue,
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
        messageQueue.close()
        messageQueueRef.current = null

        // Check for completion
        if (finalResult.includes("<promise>COMPLETE</promise>")) {
          if (watch) {
            // Enter watch mode instead of exiting
            setIsWatching(true)
          } else {
            exit()
            process.exit(0)
          }
          return
        }

        // Move to next iteration
        setTimeout(() => setCurrentIteration(i => i + 1), 500)
      } catch (err) {
        setIsRunning(false)
        messageQueue.close()
        messageQueueRef.current = null
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
      messageQueue.close()
      messageQueueRef.current = null
    }
  }, [currentIteration, totalIterations, exit, watch, watchCycle])

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

  // Render a static item (header, iteration header, or content block)
  const renderStaticItem = (item: StaticItem) => {
    if (item.type === "header") {
      return <Header claudeVersion={item.claudeVersion} ralphVersion={item.ralphVersion} />
    }
    if (item.type === "iteration") {
      return (
        <Box flexDirection="column" marginTop={1}>
          <Gradient colors={["#30A6E4", "#EBC635"]}>
            <BigText text={`R${item.iteration}`} font="tiny" />
          </Gradient>
        </Box>
      )
    }
    // Content block
    const lines = formatContentBlock(item.block)
    return (
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, i) => (
          <Text key={i}>{line || " "}</Text>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {/* Static content that has already been rendered - won't re-render */}
      <Static items={staticItems}>
        {item => (
          <Box key={item.key} flexDirection="column">
            {renderStaticItem(item)}
          </Box>
        )}
      </Static>

      {/* Todo input (shown when Ctrl-T is pressed) */}
      {isAddingTodo && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">Todo:</Text>
          <EnhancedTextInput value={todoText} onChange={setTodoText} onSubmit={handleTodoSubmit} />
          <Text dimColor>(Enter to add, Esc to cancel)</Text>
        </Box>
      )}

      {/* Todo message (success or error) */}
      {todoMessage && (
        <Box marginTop={1}>
          <Text color={todoMessage.type === "success" ? "green" : "red"}>{todoMessage.text}</Text>
        </Box>
      )}

      {/* User message input (shown when Ctrl-M is pressed) */}
      {isAddingUserMessage && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">Message to Claude:</Text>
          <EnhancedTextInput
            value={userMessageText}
            onChange={setUserMessageText}
            onSubmit={handleUserMessageSubmit}
          />
          <Text dimColor>(Enter to send, Esc to cancel)</Text>
        </Box>
      )}

      {/* User message status */}
      {userMessageStatus && (
        <Box marginTop={1}>
          <Text
            color={
              userMessageStatus.type === "success" ? "green"
              : userMessageStatus.type === "error" ?
                "red"
              : "yellow"
            }
          >
            {userMessageStatus.text}
          </Text>
        </Box>
      )}

      {/* Dynamic footer with spinner and progress bar */}
      <Box marginTop={1} justifyContent="space-between">
        {isWatching ?
          detectedIssue ?
            <Text color="green">
              <Spinner type="dots" /> New issue: <Text color="yellow">{detectedIssue.IssueID}</Text>
              {detectedIssue.Title ? ` - ${detectedIssue.Title}` : ""}
            </Text>
          : <Text color="magenta">
              <Spinner type="dots" /> Watching for new issues...
            </Text>

        : isRunning ?
          <Text color="cyan">
            <Spinner type="dots" /> Running round <Text color="yellow">{currentIteration}</Text>{" "}
            (max {totalIterations})
          </Text>
        : <Text dimColor>Ready</Text>}
        {progressData.type !== "none" && progressData.total > 0 && (
          <ProgressBar remaining={progressData.remaining} total={progressData.total} />
        )}
      </Box>
    </Box>
  )
}

type Props = {
  totalIterations: number
  claudeVersion: string
  ralphVersion: string
  watch?: boolean
}
