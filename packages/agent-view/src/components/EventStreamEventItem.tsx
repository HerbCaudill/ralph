import { UserMessage } from "./UserMessage"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"
import { ErrorEvent } from "./ErrorEvent"
import type { ToolResult } from "../lib/buildToolResultsMap"
import { renderEventContentBlock } from "../lib/renderEventContentBlock"
import {
  shouldFilterEventByType,
  logEventFilterDecision,
  type FilterReason,
} from "../lib/EventFilterPipeline"
import { isAssistantMessage } from "../lib/isAssistantMessage"
import { isErrorEvent } from "../lib/isErrorEvent"
import { isRalphTaskCompletedEvent } from "../lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "../lib/isRalphTaskStartedEvent"
import { isUserMessageEvent } from "../lib/isUserMessageEvent"
import type { ChatEvent, TaskLifecycleEventData, ErrorEventData } from "../types"

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
export function EventStreamEventItem({
  event,
  toolResults,
  hasStructuredLifecycleEvents,
  eventIndex,
}: Props) {
  // Use centralized filter logic to check if event should be rendered
  const filterResult = shouldFilterEventByType(event)

  // Log filter decision when debug mode is enabled
  // Enable with: localStorage.setItem('ralph-filter-debug', 'true')
  logEventFilterDecision(event, filterResult)

  if (!filterResult.shouldRender) {
    return null
  }

  // Render appropriate component based on event type
  if (isUserMessageEvent(event)) {
    return <UserMessage event={event} />
  }

  if (isRalphTaskStartedEvent(event)) {
    const lifecycleEvent: TaskLifecycleEventData = {
      type: "task_lifecycle",
      timestamp: event.timestamp,
      action: "starting",
      taskId: event.taskId ?? "",
    }
    return <TaskLifecycleEvent event={lifecycleEvent} />
  }

  if (isRalphTaskCompletedEvent(event)) {
    const lifecycleEvent: TaskLifecycleEventData = {
      type: "task_lifecycle",
      timestamp: event.timestamp,
      action: "completed",
      taskId: event.taskId ?? "",
    }
    return <TaskLifecycleEvent event={lifecycleEvent} />
  }

  if (isAssistantMessage(event)) {
    const content = event.message?.content

    if (!content || content.length === 0) return null

    return (
      <>
        {content.map((block, index) =>
          renderEventContentBlock(block, index, event.timestamp, toolResults, {
            hasStructuredLifecycleEvents,
            eventIndex,
          }),
        )}
      </>
    )
  }

  if (isErrorEvent(event)) {
    const errorEvent: ErrorEventData = {
      type: event.type,
      timestamp: event.timestamp,
      error: event.error,
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
  toolResults: Map<string, ToolResult>
  hasStructuredLifecycleEvents: boolean
  /** Index of the event in the parent list, used to generate unique React keys across events */
  eventIndex?: number
}
