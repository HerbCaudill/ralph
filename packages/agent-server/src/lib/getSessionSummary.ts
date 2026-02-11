import { parseTaskLifecycleEvent } from "./parseTaskLifecycleEvent.js"
import type { SessionPersister } from "@herbcaudill/ralph-shared/server"

/** Summary information extracted from a session's events. */
export interface SessionSummary {
  /** The first task ID found in the session's events. */
  taskId?: string
  /** The first user message found in the session's events. */
  firstUserMessage?: string
}

/**
 * Extract summary information from a session's persisted events.
 * Returns the first task ID found via start_task tags, or null if none found.
 */
export async function getSessionSummary(
  /** The session ID to read events from. */
  sessionId: string,
  /** The session persister to read events from. */
  persister: SessionPersister,
  /** Optional app namespace for the session. */
  app?: string,
): Promise<SessionSummary | null> {
  const events = await persister.readEvents(sessionId, app)
  let taskId: string | undefined
  let firstUserMessage: string | undefined

  for (const event of events) {
    if (!firstUserMessage && event.type === "user_message" && typeof event.message === "string") {
      const trimmedMessage = event.message.trim()
      if (trimmedMessage.length > 0) {
        firstUserMessage = trimmedMessage
      }
    }

    if (!taskId) {
      taskId = extractTaskIdFromEvent(event) ?? undefined
    }

    if (taskId && firstUserMessage) {
      break
    }
  }

  if (!taskId && !firstUserMessage) {
    return null
  }

  return {
    ...(taskId ? { taskId } : {}),
    ...(firstUserMessage ? { firstUserMessage } : {}),
  }
}

/** Extract text content from an event that might contain task lifecycle tags. */
function extractTaskIdFromEvent(event: Record<string, unknown>): string | null {
  // Check direct message content
  if (typeof event.content === "string") {
    const parsed = parseTaskLifecycleEvent(event.content, event.timestamp as number | undefined)
    if (parsed?.action === "starting") {
      return parsed.taskId
    }
  }

  // Check content_block_delta with text_delta
  if (event.type === "content_block_delta") {
    const delta = event.delta as { type?: string; text?: string } | undefined
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      const parsed = parseTaskLifecycleEvent(delta.text, event.timestamp as number | undefined)
      if (parsed?.action === "starting") {
        return parsed.taskId
      }
    }
  }

  // Check assistant message with content array
  if (event.type === "assistant") {
    const message = event.message as
      | { content?: Array<{ type: string; text?: string }> }
      | undefined
    if (Array.isArray(message?.content)) {
      for (const block of message.content) {
        if (block.type === "text" && typeof block.text === "string") {
          const parsed = parseTaskLifecycleEvent(block.text, event.timestamp as number | undefined)
          if (parsed?.action === "starting") {
            return parsed.taskId
          }
        }
      }
    }
  }

  return null
}
