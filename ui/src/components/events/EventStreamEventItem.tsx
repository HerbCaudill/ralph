import { UserMessage } from "./UserMessage"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"
import { renderEventContentBlock } from "@/lib/renderEventContentBlock"
import { isAssistantMessage } from "@/lib/isAssistantMessage"
import { isRalphTaskCompletedEvent } from "@/lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "@/lib/isRalphTaskStartedEvent"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
import { isUserMessageEvent } from "@/lib/isUserMessageEvent"
import type { RalphEvent, TaskLifecycleEventData, AssistantContentBlock } from "@/types"

export function EventStreamEventItem({
  event,
  toolResults,
  hasStructuredLifecycleEvents,
}: Props) {
  if (isUserMessageEvent(event)) {
    return <UserMessage event={event} />
  }

  if (isRalphTaskStartedEvent(event)) {
    const taskEvent = event as any
    const lifecycleEvent: TaskLifecycleEventData = {
      type: "task_lifecycle",
      timestamp: event.timestamp,
      action: "starting",
      taskId: taskEvent.taskId,
      taskTitle: taskEvent.taskTitle,
    }
    return <TaskLifecycleEvent event={lifecycleEvent} />
  }

  if (isRalphTaskCompletedEvent(event)) {
    const taskEvent = event as any
    const lifecycleEvent: TaskLifecycleEventData = {
      type: "task_lifecycle",
      timestamp: event.timestamp,
      action: "completed",
      taskId: taskEvent.taskId,
      taskTitle: taskEvent.taskTitle,
    }
    return <TaskLifecycleEvent event={lifecycleEvent} />
  }

  if (isAssistantMessage(event)) {
    const message = (event as any).message
    const content = message?.content as AssistantContentBlock[] | undefined

    if (!content || content.length === 0) return null

    return (
      <>
        {content.map((block, index) =>
          renderEventContentBlock(block, index, event.timestamp, toolResults, {
            hasStructuredLifecycleEvents,
          }),
        )}
      </>
    )
  }

  if (isToolResultEvent(event)) {
    return null
  }

  if (event.type === "stream_event") {
    return null
  }

  if (event.type === "system") {
    return null
  }

  return null
}

type Props = {
  event: RalphEvent
  toolResults: Map<string, { output?: string; error?: string }>
  hasStructuredLifecycleEvents: boolean
}
