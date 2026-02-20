import { SessionPersister } from "@herbcaudill/ralph-shared/server"
import { parseTaskLifecycleEvent } from "@herbcaudill/ralph-shared"

/** Result of finding an incomplete session. */
export interface IncompleteSessionResult {
  /** The session ID of the incomplete session. */
  sessionId: string
  /** The task ID that was started but not completed. */
  taskId: string
  /** The app namespace. */
  app?: string
  /** The workspace identifier. */
  workspace?: string
}

/**
 * Find any incomplete session for the given app.
 *
 * An incomplete session is one that:
 * - Contains a `<start_task>{taskId}</start_task>` marker for some task
 * - Does NOT contain an `<end_task>` marker for that same task
 *
 * This is used to resume interrupted sessions rather than starting over.
 *
 * @param persister - SessionPersister instance for reading session files
 * @param app - The app namespace to search in (e.g., "ralph")
 * @returns The sessionId and taskId of an incomplete session, or null if none found
 */
export async function findAnyIncompleteSession(
  persister: SessionPersister,
  app: string,
): Promise<IncompleteSessionResult | null> {
  // Get all sessions for this app (across all workspaces)
  const sessions = persister.listSessionsWithApp(app)

  for (const { sessionId, app: sessionApp, workspace } of sessions) {
    const events = await persister.readEvents(sessionId, sessionApp, workspace)

    // Track which tasks have been started and completed in this session
    const startedTasks = new Set<string>()
    const completedTasks = new Set<string>()

    for (const event of events) {
      const text = extractTextFromEvent(event)
      if (!text) continue

      const lifecycle = parseTaskLifecycleEvent(text, event.timestamp as number | undefined)
      if (!lifecycle) continue

      if (lifecycle.action === "starting") {
        startedTasks.add(lifecycle.taskId)
      } else if (lifecycle.action === "completed") {
        completedTasks.add(lifecycle.taskId)
      }
    }

    // Find a task that was started but not completed
    for (const taskId of startedTasks) {
      if (!completedTasks.has(taskId)) {
        return { sessionId, taskId, app: sessionApp, workspace }
      }
    }
  }

  return null
}

/**
 * Find an incomplete session for a given task ID.
 *
 * An incomplete session is one that:
 * - Contains a `<start_task>{taskId}</start_task>` marker
 * - Does NOT contain an `<end_task>` marker
 *
 * This is used to resume interrupted sessions rather than starting over.
 *
 * @param persister - SessionPersister instance for reading session files
 * @param taskId - The task ID to search for (e.g., "r-abc123")
 * @param app - The app namespace to search in (e.g., "ralph")
 * @returns The sessionId of an incomplete session, or null if none found
 */
export async function findIncompleteSession(
  persister: SessionPersister,
  taskId: string,
  app: string,
): Promise<string | null> {
  // Get all sessions for this app (across all workspaces)
  const sessions = persister.listSessionsWithApp(app)

  for (const { sessionId, app: sessionApp, workspace } of sessions) {
    const events = await persister.readEvents(sessionId, sessionApp, workspace)

    let hasStartTask = false
    let hasEndTask = false

    for (const event of events) {
      // Look for task lifecycle markers in assistant messages
      const text = extractTextFromEvent(event)
      if (!text) continue

      const lifecycle = parseTaskLifecycleEvent(text, event.timestamp as number | undefined)
      if (!lifecycle) continue

      if (lifecycle.taskId === taskId) {
        if (lifecycle.action === "starting") {
          hasStartTask = true
        } else if (lifecycle.action === "completed") {
          hasEndTask = true
        }
      }
    }

    // Return this session if it started the task but didn't complete it
    if (hasStartTask && !hasEndTask) {
      return sessionId
    }
  }

  return null
}

/**
 * Extract text content from a session event that might contain task markers.
 *
 * Task markers (`<start_task>` and `<end_task>`) appear in assistant responses.
 * This function extracts text from:
 * - `assistant` events with `message.content` blocks
 * - Plain text events
 */
function extractTextFromEvent(event: Record<string, unknown>): string | null {
  // Handle assistant events with structured content
  if (event.type === "assistant" && event.message) {
    const message = event.message as Record<string, unknown>
    const content = message.content

    if (Array.isArray(content)) {
      // Extract text from content blocks
      const texts: string[] = []
      for (const block of content) {
        if (typeof block === "object" && block !== null) {
          const blockObj = block as Record<string, unknown>
          if (blockObj.type === "text" && typeof blockObj.text === "string") {
            texts.push(blockObj.text)
          }
        }
      }
      return texts.join("\n") || null
    }
  }

  // Handle user_message events (Ralph outputs markers in responses, but
  // the <start_task> marker might also appear in system prompts)
  if (event.type === "user_message" && typeof event.message === "string") {
    return event.message
  }

  return null
}
