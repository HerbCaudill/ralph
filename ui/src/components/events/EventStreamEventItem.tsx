import { UserMessage } from "./UserMessage"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"
import { ErrorEvent } from "./ErrorEvent"
import { renderEventContentBlock } from "@/lib/renderEventContentBlock"
import { isAssistantMessage } from "@/lib/isAssistantMessage"
import { isErrorEvent } from "@/lib/isErrorEvent"
import { isRalphTaskCompletedEvent } from "@/lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "@/lib/isRalphTaskStartedEvent"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
import { isUserMessageEvent } from "@/lib/isUserMessageEvent"
import type {
  RalphEvent,
  TaskLifecycleEventData,
  ErrorEventData,
  AssistantContentBlock,
} from "@/types"

/**
 * Renders different types of Ralph events (user messages, task lifecycle events, assistant messages, errors).
 * Routes each event type to the appropriate specialized component.
 */
export function EventStreamEventItem({ event, toolResults, hasStructuredLifecycleEvents }: Props) {
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

  if (isErrorEvent(event)) {
    const errorEvent: ErrorEventData = {
      type: event.type as "error" | "server_error",
      timestamp: event.timestamp,
      error: (event as any).error,
    }
    return <ErrorEvent event={errorEvent} />
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
