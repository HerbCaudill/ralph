import { useContext } from "react"
import { AssistantText } from "./AssistantText"
import { UserMessage } from "./UserMessage"
import { ErrorEvent } from "./ErrorEvent"
import { ThinkingBlock } from "./ThinkingBlock"
import { ToolUseCard } from "./ToolUseCard"
import type { ToolResult } from "../lib/buildToolResultsMap"
import { renderEventContentBlock } from "../lib/renderEventContentBlock"
import {
  shouldFilterEventByType,
  logEventFilterDecision,
  type FilterReason,
} from "../lib/EventFilterPipeline"
import { isAgentMessageEvent } from "../lib/isAgentMessageEvent"
import { isAgentThinkingEvent } from "../lib/isAgentThinkingEvent"
import { isAssistantMessage } from "../lib/isAssistantMessage"
import { isErrorEvent } from "../lib/isErrorEvent"
import { isRalphTaskCompletedEvent } from "../lib/isRalphTaskCompletedEvent"
import { isRalphTaskStartedEvent } from "../lib/isRalphTaskStartedEvent"
import { isToolUseChatEvent } from "../lib/isToolUseChatEvent"
import { isUserMessageEvent } from "../lib/isUserMessageEvent"
import { AgentViewContext } from "../context/AgentViewContext"
import type { ChatEvent, TaskLifecycleEventData, ErrorEventData, ToolUseChatEvent } from "../types"

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
  const { customEventRenderers } = useContext(AgentViewContext)

  // Use centralized filter logic to check if event should be rendered
  const filterResult = shouldFilterEventByType(event)

  // DEBUG: log every event and filter decision
  console.log("[EventStreamEventItem]", JSON.stringify(event, null, 2), filterResult)

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
    const customRenderer = customEventRenderers?.["task_lifecycle"]
    return customRenderer ? <>{customRenderer(lifecycleEvent)}</> : null
  }

  if (isRalphTaskCompletedEvent(event)) {
    const lifecycleEvent: TaskLifecycleEventData = {
      type: "task_lifecycle",
      timestamp: event.timestamp,
      action: "completed",
      taskId: event.taskId ?? "",
    }
    const customRenderer = customEventRenderers?.["task_lifecycle"]
    return customRenderer ? <>{customRenderer(lifecycleEvent)}</> : null
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
            customEventRenderers,
          }),
        )}
      </>
    )
  }

  // Agent-server adapters emit individual "message" events instead of structured
  // "assistant" events with content blocks. Render non-partial messages as assistant text.
  // Partial messages are streaming deltas that duplicate the final assistant event.
  if (isAgentMessageEvent(event)) {
    if (event.isPartial) return null
    return (
      <AssistantText event={{ type: "text", timestamp: event.timestamp, content: event.content }} />
    )
  }

  // Agent-server adapters emit individual "thinking" events for extended thinking.
  // Render non-partial thinking blocks. Partial ones are streaming deltas.
  if (isAgentThinkingEvent(event)) {
    if (event.isPartial) return null
    return <ThinkingBlock content={event.content} />
  }

  if (isToolUseChatEvent(event)) {
    const result = event.toolUseId ? toolResults.get(event.toolUseId) : undefined
    return (
      <ToolUseCard
        event={{
          ...event,
          output: event.output ?? result?.output,
          error: event.error ?? result?.error,
          status:
            result ?
              result.error ?
                "error"
              : "success"
            : event.status,
        }}
      />
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
