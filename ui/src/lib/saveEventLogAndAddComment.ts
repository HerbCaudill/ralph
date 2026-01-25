import { eventDatabase } from "@/lib/persistence"
import type { PersistedEventLog } from "@/lib/persistence/types"
import type { ChatEvent } from "@/types"

/**
 * Generate a unique ID for an event log.
 */
function generateEventLogId(): string {
  return `event-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function saveEventLogAndAddComment(
  taskId: string,
  taskTitle: string,
  events: ChatEvent[],
  workspacePath: string | null,
): Promise<string | null> {
  if (events.length === 0) {
    return null
  }

  try {
    // Generate unique ID and create event log
    const eventLogId = generateEventLogId()
    const now = Date.now()

    const eventLog: PersistedEventLog = {
      id: eventLogId,
      taskId,
      taskTitle,
      source: "task-close",
      workspacePath,
      createdAt: now,
      eventCount: events.length,
      events,
    }

    // Save to IndexedDB
    await eventDatabase.init()
    await eventDatabase.saveEventLog(eventLog)

    // Add closing comment to the task via API
    const commentResponse = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: `Closed. Event log: #eventlog=${eventLogId}`,
        author: "Ralph",
      }),
    })

    if (!commentResponse.ok) {
      console.error("Failed to add closing comment:", await commentResponse.text())
    }

    return eventLogId
  } catch (err) {
    console.error("Error saving event log:", err)
    return null
  }
}
