import React, { useState, useEffect, useRef } from "react"
import { Box, Text, useApp, Static, useInput } from "ink"
import Spinner from "ink-spinner"
import { EnhancedTextInput } from "./EnhancedTextInput.js"
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs"
import { join, basename } from "path"
import { getDefaultStorageDir } from "@herbcaudill/ralph-shared"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { eventToBlocks } from "./eventToBlocks.js"
import { addTodo } from "../lib/addTodo.js"
import { getProgress } from "../lib/getProgress.js"
import { captureStartupSnapshot } from "../lib/captureStartupSnapshot.js"
import type { ProgressData, StartupSnapshot } from "../lib/types.js"
import { ProgressBar } from "./ProgressBar.js"
import { watchForNewIssues, type MutationEvent } from "../lib/beadsClient.js"
import { MessageQueue, createUserMessage } from "../lib/MessageQueue.js"
import { createDebugLogger } from "../lib/debug.js"
import { useTerminalSize } from "../lib/useTerminalSize.js"
import { parseTaskLifecycleEvent } from "../lib/parseTaskLifecycle.js"
import { getPromptContent } from "../lib/getPromptContent.js"
import { sdkMessageToEvent } from "../lib/sdkMessageToEvent.js"
import { processEvents } from "../lib/processEvents.js"
import { renderStaticItem } from "./renderStaticItem.js"
import { type StaticItem, type SessionRunnerProps } from "./SessionRunner.types.js"

/** Debug logger for session lifecycle events */
const log = createDebugLogger("session")

/** The .ralph directory path in the current working directory */
const ralphDir = join(process.cwd(), ".ralph")

/** Path to the todo.md file in the .ralph directory */
const todoFile = join(ralphDir, "todo.md")

/** The name of the current repository (basename of cwd) */
const repoName = basename(process.cwd())

/**
 * Orchestrates the iterative execution of Claude AI sessions.
 *
 * Spawns Claude CLI with prompts, captures streaming output, displays formatted UI,
 * and handles user input during session execution.
 */
export const SessionRunner = ({
  totalSessions,
  claudeVersion,
  ralphVersion,
  watch,
  agent,
}: SessionRunnerProps) => {
  const { exit } = useApp()
  const { columns } = useTerminalSize()
  const [currentSession, setCurrentSession] = useState(1)
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const eventsRef = useRef<Array<Record<string, unknown>>>([])
  const [error, setError] = useState<string>()
  const [isRunning, setIsRunning] = useState(false)
  const [isAddingTodo, setIsAddingTodo] = useState(false)
  const [todoText, setTodoText] = useState("")
  const [todoMessage, setTodoMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [userMessageText, setUserMessageText] = useState("")
  const [userMessageStatus, setUserMessageStatus] = useState<{
    type: "success" | "error" | "pending"
    text: string
  } | null>(null)
  const [hasTodoFile, setHasTodoFile] = useState(false)
  const [startupSnapshot] = useState<StartupSnapshot | undefined>(() => captureStartupSnapshot())
  const [progressData, setProgressData] = useState<ProgressData>(() => {
    const snapshot = captureStartupSnapshot()
    if (!snapshot) return { type: "none", completed: 0, total: 0 }
    return { type: snapshot.type, completed: 0, total: snapshot.initialCount }
  })
  const [isWatching, setIsWatching] = useState(false)
  const [detectedIssue, setDetectedIssue] = useState<MutationEvent | null>(null)
  const watchCleanupRef = useRef<(() => void) | null>(null)
  const [watchCycle, setWatchCycle] = useState(0) // Increments to force useEffect re-run
  const [stopAfterCurrent, setStopAfterCurrent] = useState(false) // Stop gracefully after current session
  const stopAfterCurrentRef = useRef(false) // Ref to access in async callbacks
  const [isPaused, setIsPaused] = useState(false) // Pause after current session completes
  const isPausedRef = useRef(false) // Ref to access in async callbacks
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const taskCompletedAbortRef = useRef(false) // Tracks abort triggered by task completion

  // Track static items that have been rendered (for Ink's Static component)
  const [staticItems, setStaticItems] = useState<StaticItem[]>([
    { type: "header", claudeVersion, ralphVersion, key: "header" },
  ])
  const renderedBlocksRef = useRef<Set<string>>(new Set())
  const lastSessionRef = useRef<number>(0)
  // Message queue for sending user messages to Claude while running
  const messageQueueRef = useRef<MessageQueue | null>(null)
  // Log file path for the current session (set when we receive the session_id from the SDK)
  const logFileRef = useRef<string | null>(null)

  /** Whether stdin supports raw mode (required for keyboard input handling) */
  const stdinSupportsRawMode = process.stdin.isTTY === true

  /**
   * Handle adding a new todo when Ctrl-T is pressed.
   */
  const handleTodoSubmit = (
    /** The todo text to add */
    text: string,
  ) => {
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

  /**
   * Handle submitting a user message to Claude during session.
   */
  const handleUserMessageSubmit = (
    /** The message text from the user */
    text: string,
  ) => {
    const trimmed = text.trim()
    if (!trimmed) {
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

      // No confirmation message - the user message appears directly in the stream
    } else {
      setUserMessageStatus({
        type: "error",
        text: "Unable to send message - Claude is not running",
      })
    }

    setUserMessageText("")
    // Clear status message after 3 seconds
    setTimeout(() => setUserMessageStatus(null), 3000)
  }

  /**
   * Handle keyboard input for Ctrl-T (todo), Ctrl-S (stop), Ctrl-P (pause), and Escape (cancel).
   */
  useInput(
    (
      /** The input character */
      input,
      /** The key information including modifiers */
      key,
    ) => {
      // Ctrl-T to start adding a todo (only if todo.md exists)
      if (key.ctrl && input === "t" && hasTodoFile) {
        setIsAddingTodo(true)
        setTodoText("")
        setTodoMessage(null)
      }
      // Ctrl-S to request stop after current session
      if (key.ctrl && input === "s" && isRunning && !stopAfterCurrent) {
        setStopAfterCurrent(true)
      }
      // Ctrl-P to toggle pause state
      if (key.ctrl && input === "p") {
        if (isPaused) {
          // Resume - if we were paused between sessions, trigger next session
          setIsPaused(false)
          if (!isRunning) {
            setTimeout(() => setCurrentSession(i => i + 1), 100)
          }
        } else if (isRunning) {
          // Request pause after current session
          setIsPaused(true)
        }
      }
      // Escape to cancel todo input
      if (key.escape) {
        if (isAddingTodo) {
          // Cancel todo input
          setIsAddingTodo(false)
          setTodoText("")
        }
      }
    },
    { isActive: stdinSupportsRawMode },
  )

  // Keep ref in sync with events state for access in callbacks
  useEffect(() => {
    eventsRef.current = events
  }, [events])

  // Keep stopAfterCurrent ref in sync with state for access in async callbacks
  useEffect(() => {
    stopAfterCurrentRef.current = stopAfterCurrent
  }, [stopAfterCurrent])

  // Keep isPaused ref in sync with state for access in async callbacks
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Update progress data when session changes or running stops
  useEffect(() => {
    if (!isRunning && startupSnapshot) {
      setProgressData(getProgress(startupSnapshot.initialCount, startupSnapshot.timestamp))
    }
  }, [currentSession, isRunning, startupSnapshot])

  // Poll progress data periodically while running to catch newly created/closed issues
  useEffect(() => {
    if (!isRunning || !startupSnapshot) return

    const pollInterval = setInterval(() => {
      setProgressData(getProgress(startupSnapshot.initialCount, startupSnapshot.timestamp))
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(pollInterval)
  }, [isRunning, startupSnapshot])

  // Watch for new issues when in watch mode
  useEffect(() => {
    if (!isWatching) return

    // Start watching for new issues
    const cleanup = watchForNewIssues(issue => {
      setDetectedIssue(issue)
      // Refresh progress data to pick up the new issue
      // The timestamp-based counting will automatically include it
      if (startupSnapshot) {
        setProgressData(getProgress(startupSnapshot.initialCount, startupSnapshot.timestamp))
      }
      // Brief pause to show the detected issue, then resume
      setTimeout(() => {
        setIsWatching(false)
        setDetectedIssue(null)
        // Reset rendered blocks for new cycle
        renderedBlocksRef.current.clear()
        // Increment round number when picking up new issue
        setCurrentSession(i => i + 1)
        setWatchCycle(c => c + 1)
      }, 1500)
    })

    watchCleanupRef.current = cleanup

    return () => {
      cleanup()
      watchCleanupRef.current = null
    }
  }, [isWatching, startupSnapshot])

  // Convert events to static items as they arrive
  useEffect(() => {
    const newItems: StaticItem[] = []

    // Add session header if this is a new session
    if (currentSession > lastSessionRef.current) {
      newItems.push({
        type: "session",
        session: currentSession,
        key: `session-${currentSession}`,
      })
      lastSessionRef.current = currentSession
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
  }, [events, currentSession])

  useEffect(() => {
    if (currentSession > totalSessions) {
      exit()
      return
    }

    // Check if there are any tasks available before starting a round
    // This avoids running Claude unnecessarily when there's no work to do
    const currentProgress =
      startupSnapshot ?
        getProgress(startupSnapshot.initialCount, startupSnapshot.timestamp)
      : { type: "none" as const, completed: 0, total: 0 }
    // All tasks are complete when completed equals total
    if (currentProgress.completed >= currentProgress.total && currentProgress.type !== "none") {
      // No tasks available - go straight to watching if enabled
      if (watch) {
        setIsWatching(true)
      } else {
        exit()
        process.exit(0)
      }
      return
    }

    // Reset log file for this session — will be set when we get the SDK session_id
    logFileRef.current = null
    setEvents([])

    // Read prompt (from .ralph/prompt.md or falling back to templates)
    const promptContent = getPromptContent()
    const todoExists = existsSync(todoFile)
    setHasTodoFile(todoExists)
    const todoContent = todoExists ? readFileSync(todoFile, "utf-8") : ""
    const roundHeader = `# Ralph, round ${currentSession}\n\n`
    const fullPrompt =
      todoContent ?
        `${roundHeader}${promptContent}\n\n## Current Todo List\n\n${todoContent}`
      : `${roundHeader}${promptContent}`

    const abortController = new AbortController()
    taskCompletedAbortRef.current = false
    setIsRunning(true)

    // Session ID will be set from the SDK init message
    sessionIdRef.current = null

    // Create a message queue for this session
    // This allows us to send follow-up user messages to Claude while it's running
    const messageQueue = new MessageQueue()
    messageQueueRef.current = messageQueue

    // Push the initial prompt as the first message
    messageQueue.push(createUserMessage(fullPrompt))

    /**
     * Execute a query to Claude and handle the streaming response.
     */
    const runQuery = async () => {
      let finalResult = ""
      log(`Starting session ${currentSession}`)

      try {
        log(`Beginning query() loop`)
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
              // Signal that tests should use minimal reporters (dots)
              RALPH_QUIET: "1",
            },
          },
        })) {
          log(`Received message type: ${message.type}`)

          // Extract session_id from the SDK init message and create the log file
          if (
            !logFileRef.current &&
            message.type === "system" &&
            "session_id" in message &&
            typeof message.session_id === "string"
          ) {
            const storageDir = join(getDefaultStorageDir(), "ralph")
            if (!existsSync(storageDir)) {
              mkdirSync(storageDir, { recursive: true })
            }
            logFileRef.current = join(storageDir, `${message.session_id}.jsonl`)
            sessionIdRef.current = message.session_id
          }

          // Log raw message to file (JSONL format - one JSON object per line)
          if (logFileRef.current) {
            appendFileSync(logFileRef.current, JSON.stringify(message) + "\n")
          }

          // Convert to event format for display
          const event = sdkMessageToEvent(message)
          if (event) {
            setEvents(prev => [...prev, event])
          }

          // Check for task lifecycle events in assistant messages
          if (message.type === "assistant") {
            const assistantMessage = message.message as Record<string, unknown> | undefined
            const content = assistantMessage?.content as Array<Record<string, unknown>> | undefined
            if (content) {
              for (const block of content) {
                if (block.type === "text" && typeof block.text === "string") {
                  const taskInfo = parseTaskLifecycleEvent(block.text)
                  if (taskInfo) {
                    if (taskInfo.action === "starting") {
                      setCurrentTaskId(taskInfo.taskId ?? null)
                      log(`Task started: ${taskInfo.taskId}`)
                      // Emit ralph_task_started event to log file
                      if (logFileRef.current) {
                        const taskStartedEvent = {
                          type: "ralph_task_started",
                          taskId: taskInfo.taskId,
                          session: currentSession,
                          sessionId: sessionIdRef.current,
                        }
                        appendFileSync(logFileRef.current, JSON.stringify(taskStartedEvent) + "\n")
                      }
                    } else if (taskInfo.action === "completed") {
                      log(`Task completed: ${taskInfo.taskId}`)
                      // Emit ralph_task_completed event to log file
                      if (logFileRef.current) {
                        const taskCompletedEvent = {
                          type: "ralph_task_completed",
                          taskId: taskInfo.taskId,
                          session: currentSession,
                          sessionId: sessionIdRef.current,
                        }
                        appendFileSync(
                          logFileRef.current,
                          JSON.stringify(taskCompletedEvent) + "\n",
                        )
                      }
                      // Abort the current query to enforce one-task-per-session.
                      // Without this, Claude may ignore "end your turn" and loop
                      // through bd ready to pick up additional tasks in one session.
                      log(`Aborting session after task completion to enforce session boundary`)
                      taskCompletedAbortRef.current = true
                      abortController.abort()
                    }
                  }
                }
              }
            }
          }

          // Capture the final result message
          if (
            message.type === "result" &&
            "result" in message &&
            typeof message.result === "string"
          ) {
            log(`Received result message`)
            finalResult = message.result
            // Close the message queue immediately when we get the result.
            // This is critical to prevent hangs: the SDK's streamInput() needs
            // to complete iterating our queue before it can call endInput(),
            // which signals EOF to the CLI. If we wait until after the for-await
            // loop exits, we create a circular dependency that can cause hangs.
            log(`Closing message queue on result`)
            messageQueue.close()
          }
        }

        log(`query() loop completed normally`)
        setIsRunning(false)
        // MessageQueue should already be closed when we received the result message.
        // We ensure it's closed here as a safety measure (close() is idempotent).
        log(`Ensuring message queue is closed`)
        messageQueue.close()
        messageQueueRef.current = null

        // Check for stop-after-current request
        if (stopAfterCurrentRef.current) {
          log(`Stop after current requested - exiting gracefully`)
          exit()
          process.exit(0)
          return
        }

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

        // Check for pause request - if paused, we wait for resume via Ctrl-P
        if (isPausedRef.current) {
          log(`Paused after session ${currentSession}`)
          // Don't move to next session - the resume handler (Ctrl-P) will trigger it
          return
        }

        // Move to next session
        setTimeout(() => setCurrentSession(i => i + 1), 500)
      } catch (err) {
        log(`query() loop error: ${err instanceof Error ? err.message : String(err)}`)
        setIsRunning(false)
        log(`Closing message queue after error`)
        messageQueue.close()
        messageQueueRef.current = null
        if (abortController.signal.aborted) {
          // Check if the abort was triggered by task completion
          if (taskCompletedAbortRef.current) {
            log(`Session aborted after task completion — advancing to next session`)
            taskCompletedAbortRef.current = false

            if (stopAfterCurrentRef.current) {
              log(`Stop after current requested - exiting gracefully`)
              exit()
              process.exit(0)
              return
            }
            if (isPausedRef.current) {
              log(`Paused after session ${currentSession}`)
              return
            }
            // Advance to the next session
            setTimeout(() => setCurrentSession(i => i + 1), 500)
            return
          }
          log(`Abort signal detected`)
          return // Intentionally aborted (e.g. cleanup)
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
      log(`Cleanup: aborting and closing queue for session ${currentSession}`)
      abortController.abort()
      messageQueue.close()
      messageQueueRef.current = null
    }
  }, [currentSession, totalSessions, exit, watch, watchCycle])

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
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

      {/* User message input - visible when running, hidden when watching for new issues */}
      {!isWatching && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{"─".repeat(columns)}</Text>
          <Box>
            <Text color={isRunning ? "yellow" : "gray"}>❯ </Text>
            <EnhancedTextInput
              value={userMessageText}
              placeholder={
                isRunning ? "Type a message for Ralph..." : "Waiting for Ralph to start..."
              }
              onChange={setUserMessageText}
              onSubmit={handleUserMessageSubmit}
              focus={isRunning && !isAddingTodo}
            />
          </Box>
          {userMessageStatus && (
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
          )}
          <Text dimColor>{"─".repeat(columns)}</Text>
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
          : <Text color="cyan">
              Waiting for new issues <Spinner type="simpleDotsScrolling" />
            </Text>

        : isPaused && !isRunning ?
          <Text color="magenta">
            ⏸ Paused after round <Text color="yellow">{currentSession}</Text>{" "}
            <Text dimColor>(Ctrl-P to resume)</Text>
          </Text>
        : isRunning ?
          stopAfterCurrent ?
            <Text color="yellow">
              <Spinner type="dots" /> Stopping after round{" "}
              <Text color="yellow">{currentSession}</Text> completes...{" "}
              <Text dimColor>(Ctrl-S pressed)</Text>
            </Text>
          : isPaused ?
            <Text color="magenta">
              <Spinner type="dots" /> Pausing after round{" "}
              <Text color="yellow">{currentSession}</Text> completes...{" "}
              <Text dimColor>(Ctrl-P pressed)</Text>
            </Text>
          : <Text color="cyan">
              <Spinner type="dots" /> Running round <Text color="yellow">{currentSession}</Text>{" "}
              (max {totalSessions})
            </Text>

        : <Text color="cyan">
            <Spinner type="simpleDotsScrolling" /> Waiting for Ralph to start...
          </Text>
        }
        {progressData.type !== "none" && progressData.total > 0 && (
          <ProgressBar
            completed={progressData.completed}
            total={progressData.total}
            repoName={repoName}
          />
        )}
      </Box>
    </Box>
  )
}
