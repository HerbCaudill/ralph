import { UserMessage } from "./UserMessage"
import { renderEventContentBlock } from "@/lib/renderEventContentBlock"
import { isAssistantMessage } from "@/lib/isAssistantMessage"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
import { isUserMessageEvent } from "@/lib/isUserMessageEvent"
import type { AssistantContentBlock, ChatEvent } from "@/types"

/**
 * Renders a single event item within the event log viewer.
 * Handles user messages, assistant messages, and tool results.
 */
export function EventLogViewerEventItem({ event, toolResults }: Props) {
  if (isUserMessageEvent(event)) {
    return <UserMessage event={event} />
  }

  if (isAssistantMessage(event)) {
    const message = (event as any).message
    const content = message?.content as AssistantContentBlock[] | undefined

    if (!content || content.length === 0) return null

    return (
      <>
        {content.map((block, index) =>
          renderEventContentBlock(block, index, event.timestamp, toolResults),
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

/**
 * Props for the EventLogViewerEventItem component
 */
type Props = {
  /** The event to render */
  event: ChatEvent
  /** Map of tool use IDs to their results for matching tool uses with results */
  toolResults: Map<string, { output?: string; error?: string }>
}
