import React, { useState, useEffect, useRef } from "react"
import { useApp, Text } from "ink"
import { writeFileSync, readFileSync, existsSync } from "fs"
import { join, basename } from "path"
import { randomUUID } from "node:crypto"
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { MessageQueue, createUserMessage } from "../lib/MessageQueue.js"
import { getProgress } from "../lib/getProgress.js"
import { captureStartupSnapshot } from "../lib/captureStartupSnapshot.js"
import type { StartupSnapshot } from "../lib/types.js"
import { createDebugLogger } from "../lib/debug.js"
import { getNextLogFile } from "../lib/getNextLogFile.js"
import { createStdinCommandHandler } from "../lib/createStdinCommandHandler.js"
import { parseTaskLifecycleEvent } from "../lib/parseTaskLifecycle.js"
import { getPromptContent } from "../lib/getPromptContent.js"
import { outputEvent } from "../lib/outputEvent.js"

/**  Debug logger for session lifecycle events */
const log = createDebugLogger("session")

/**  Path to the todo.md file in the .ralph directory */
const todoFile = join(process.cwd(), ".ralph", "todo.md")

/**  Name of the current repository */
const repoName = basename(process.cwd())

/**
 * Component that runs Claude Agent SDK sessions in JSON output mode.
 * Manages message queues, task lifecycle tracking, pause/resume, and
 * streams SDK events to stdout as newline-delimited JSON.
 */
export const JsonOutput = ({ totalSessions, agent }: Props) => {
  const { exit } = useApp()
  const [currentSession, setCurrentSession] = useState(1)
  const [error, setError] = useState<string>()
  const [isRunning, setIsRunning] = useState(false)
  const [startupSnapshot] = useState<StartupSnapshot | undefined>(() => captureStartupSnapshot())
  const messageQueueRef = useRef<MessageQueue | null>(null)
  // Log file path for this run (set once at startup, persisted across sessions)
  const logFileRef = useRef<string | null>(null)
  const [stopAfterCurrent, setStopAfterCurrent] = useState(false) // Stop gracefully after current session
  const stopAfterCurrentRef = useRef(false) // Ref to access in async callbacks
  const [isPaused, setIsPaused] = useState(false) // Pause after current session completes
  const isPausedRef = useRef(false) // Ref to access in async callbacks
  const stdinCleanupRef = useRef<(() => void) | null>(null)
  const currentTaskIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Keep stopAfterCurrent ref in sync with state
  useEffect(() => {
    stopAfterCurrentRef.current = stopAfterCurrent
  }, [stopAfterCurrent])

  // Keep isPaused ref in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Set up stdin command handler for receiving commands via piped input
  useEffect(() => {
    const cleanup = createStdinCommandHandler(() => ({
      messageQueue: messageQueueRef.current,
      onStop: () => {
        setStopAfterCurrent(true)
        outputEvent({ type: "ralph_stop_requested" })
      },
      onPause: () => {
        setIsPaused(true)
        outputEvent({ type: "ralph_pause_requested" })
      },
      onResume: () => {
        const wasPaused = isPausedRef.current
        setIsPaused(false)
        outputEvent({ type: "ralph_resumed" })
        // If we were paused between sessions, trigger the next session
        if (wasPaused && !isRunning) {
          setTimeout(() => setCurrentSession(i => i + 1), 100)
        }
      },
      onMessage: (text: string) => {
        // Output event showing we received a message command
        outputEvent({
          type: "ralph_message_received",
          text: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
        })
      },
    }))
    stdinCleanupRef.current = cleanup

    return () => {
      cleanup()
      stdinCleanupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (currentSession > totalSessions) {
      outputEvent({ type: "ralph_exit", reason: "max_sessions" })
      exit()
      return
    }

    // Check if there are any tasks available before starting a round
    const currentProgress =
      startupSnapshot ?
        getProgress(startupSnapshot.initialCount, startupSnapshot.timestamp)
      : { type: "none" as const, completed: 0, total: 0 }

    // All tasks are complete when completed equals total
    if (currentProgress.completed >= currentProgress.total && currentProgress.type !== "none") {
      outputEvent({ type: "ralph_exit", reason: "all_tasks_complete" })
      exit()
      process.exit(0)
      return
    }

    // Get or create the log file path for this run
    // Only create a new sequential log file on the first session
    if (!logFileRef.current) {
      logFileRef.current = getNextLogFile()
      writeFileSync(logFileRef.current, "")
    }

    // Read prompt (from .ralph/prompt.md or falling back to templates)
    const promptContent = getPromptContent()
    const todoExists = existsSync(todoFile)
    const todoContent = todoExists ? readFileSync(todoFile, "utf-8") : ""
    const fullPrompt =
      todoContent ? `${promptContent}\n\n## Current Todo List\n\n${todoContent}` : promptContent

    const abortController = new AbortController()
    setIsRunning(true)

    // Output session start event with server-generated session ID
    // The sessionId is a UUID that uniquely identifies this session, enabling
    // the UI to use a stable ID for IndexedDB persistence without generating its own
    const sessionId = randomUUID()
    sessionIdRef.current = sessionId
    outputEvent({
      type: "ralph_session_start",
      session: currentSession,
      totalSessions,
      repo: repoName,
      taskId: currentTaskIdRef.current,
      sessionId,
    })

    // Create a message queue for this session
    const messageQueue = new MessageQueue()
    messageQueueRef.current = messageQueue

    // Push the initial prompt as the first message
    messageQueue.push(createUserMessage(fullPrompt))

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
            includePartialMessages: false, // Only complete messages for JSON output
            env: {
              ...process.env,
              // Disable LSP plugins to avoid crashes when TypeScript LSP server errors
              ENABLE_LSP_TOOL: "0",
            },
          },
        })) {
          log(`Received message type: ${message.type}`)

          // Output the raw SDK message as JSON
          outputEvent(message as unknown as Record<string, unknown>)

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
                      currentTaskIdRef.current = taskInfo.taskId ?? null
                      log(`Task started: ${taskInfo.taskId}`)
                      // Emit ralph_task_started event
                      outputEvent({
                        type: "ralph_task_started",
                        taskId: taskInfo.taskId,
                        session: currentSession,
                        sessionId: sessionIdRef.current,
                      })
                    } else if (taskInfo.action === "completed") {
                      log(`Task completed: ${taskInfo.taskId}`)
                      // Emit ralph_task_completed event
                      outputEvent({
                        type: "ralph_task_completed",
                        taskId: taskInfo.taskId,
                        session: currentSession,
                        sessionId: sessionIdRef.current,
                      })
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
            log(`Closing message queue on result`)
            messageQueue.close()
          }
        }

        log(`query() loop completed normally`)
        setIsRunning(false)
        log(`Ensuring message queue is closed`)
        messageQueue.close()
        messageQueueRef.current = null

        // Output session end event
        outputEvent({
          type: "ralph_session_end",
          session: currentSession,
          taskId: currentTaskIdRef.current,
          sessionId: sessionIdRef.current,
        })

        // Check for stop-after-current request
        if (stopAfterCurrentRef.current) {
          log(`Stop after current requested - exiting gracefully`)
          outputEvent({ type: "ralph_exit", reason: "stop_requested" })
          exit()
          process.exit(0)
          return
        }

        // Check for completion
        if (finalResult.includes("<promise>COMPLETE</promise>")) {
          outputEvent({ type: "ralph_exit", reason: "task_complete" })
          exit()
          process.exit(0)
          return
        }

        // Check for pause request - if paused, we wait for resume via stdin
        if (isPausedRef.current) {
          log(`Paused after session ${currentSession}`)
          outputEvent({ type: "ralph_paused", session: currentSession })
          // Don't move to next session - the resume handler will trigger it
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
          log(`Abort signal detected`)
          return // Intentionally aborted
        }
        const errorMsg = `Error running Claude: ${err instanceof Error ? err.message : String(err)}`
        setError(errorMsg)
        outputEvent({ type: "ralph_error", error: errorMsg })
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
  }, [currentSession, totalSessions, exit, startupSnapshot])

  // In JSON mode, we output to stdout, so no visual rendering needed
  // Just return an empty component (Ink requires something to render)
  if (error) {
    return <Text>{""}</Text>
  }

  return <Text>{""}</Text>
}

type Props = {
  totalSessions: number
  agent: string
}
