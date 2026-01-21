import { UserMessage } from "./UserMessage"
import { renderEventContentBlock } from "@/lib/renderEventContentBlock"
import { isAssistantMessage } from "@/lib/isAssistantMessage"
import { isToolResultEvent } from "@/lib/isToolResultEvent"
import { isUserMessageEvent } from "@/lib/isUserMessageEvent"
import type { AssistantContentBlock, RalphEvent } from "@/types"

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

type Props = {
  event: RalphEvent
  toolResults: Map<string, { output?: string; error?: string }>
}
