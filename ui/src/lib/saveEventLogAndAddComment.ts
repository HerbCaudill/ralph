import type { ChatEvent } from "@/types"

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
    const response = await fetch("/api/eventlogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events,
        metadata: {
          taskId,
          title: taskTitle,
          source: "task-close",
          workspacePath: workspacePath ?? undefined,
        },
      }),
    })

    if (!response.ok) {
      console.error("Failed to save event log:", await response.text())
      return null
    }

    const result = (await response.json()) as { ok: boolean; eventlog?: { id: string } }
    if (!result.ok || !result.eventlog?.id) {
      return null
    }

    const eventLogId = result.eventlog.id

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
