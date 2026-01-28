import { UserMessage } from "./UserMessage"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"
import { ErrorEvent } from "./ErrorEvent"
import { renderEventContentBlock } from "@/lib/renderEventContentBlock"
import { shouldFilterEventByType, type FilterReason } from "@/lib/EventFilterPipeline"
import { isAssistantMessage } from "@/lib/isAssistantMessage"
import { isErrorEvent } from "@/lib/isErrorEvent"
import { isRalphTaskCompletedEvent } from "@/lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "@/lib/isRalphTaskStartedEvent"
import { isUserMessageEvent } from "@/lib/isUserMessageEvent"
import type {
  ChatEvent,
  TaskLifecycleEventData,
  ErrorEventData,
  AssistantContentBlock,
} from "@/types"

/**
 * Renders different types of Ralph events (user messages, task lifecycle events, assistant messages, errors).
 * Routes each event type to the appropriate specialized component.
 *
 * This component handles Layer 3 of the event filtering pipeline.
 * See EVENT_FILTERING_PIPELINE.md for full documentation.
 *
 * Filtered event types (return null):
 * - tool_result: Results shown inline with parent tool_use cards
 * - stream_event: Already processed by useStreamingState
 * - system: Internal events not for display
 * - unrecognized: Unknown event types
 */
export function EventStreamEventItem({ event, toolResults, hasStructuredLifecycleEvents }: Props) {
  // Use centralized filter logic to check if event should be rendered
  const filterResult = shouldFilterEventByType(event)

  // If filtered, optionally track the reason for debugging
  if (!filterResult.shouldRender) {
    // Note: filterResult.reason contains why (e.g., "tool_result_rendered_inline")
    // This can be used with debug mode in the future
    return null
  }

  // Render appropriate component based on event type
  if (isUserMessageEvent(event)) {
    return <UserMessage event={event} />
  }

  if (isRalphTaskStartedEvent(event)) {
    const taskEvent = event as Record<string, unknown>
    const lifecycleEvent: TaskLifecycleEventData = {
      type: "task_lifecycle",
      timestamp: event.timestamp,
      action: "starting",
      taskId: taskEvent.taskId as string,
    }
    return <TaskLifecycleEvent event={lifecycleEvent} />
  }

  if (isRalphTaskCompletedEvent(event)) {
    const taskEvent = event as Record<string, unknown>
    const lifecycleEvent: TaskLifecycleEventData = {
      type: "task_lifecycle",
      timestamp: event.timestamp,
      action: "completed",
      taskId: taskEvent.taskId as string,
    }
    return <TaskLifecycleEvent event={lifecycleEvent} />
  }

  if (isAssistantMessage(event)) {
    const message = (event as Record<string, unknown>).message as {
      content?: AssistantContentBlock[]
    }
    const content = message?.content

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
      error: (event as Record<string, unknown>).error as string,
    }
    return <ErrorEvent event={errorEvent} />
  }

  // Fallback: event passed filter but has no renderer
  // This shouldn't happen if RENDERABLE_EVENT_TYPES is in sync
  return null
}

/** Export filter reason type for consumers that want to track filtering */
export type { FilterReason }

type Props = {
  event: ChatEvent
  toolResults: Map<string, { output?: string; error?: string }>
  hasStructuredLifecycleEvents: boolean
}
