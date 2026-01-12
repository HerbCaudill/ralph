import React, { useState, useEffect } from "react"
import { Box } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"

export const EventDisplay = ({ events }: Props) => {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])

  useEffect(() => {
    // Deduplicate events by message ID, keeping only the latest version
    const eventsByMessageId = new Map<string, Record<string, unknown>>()
    for (const event of events) {
      if (event.type === "assistant") {
        const message = event.message as Record<string, unknown> | undefined
        const messageId = message?.id as string | undefined
        if (messageId) {
          eventsByMessageId.set(messageId, event)
        }
      } else {
        // Non-assistant events don't have message IDs, process them as-is
        // Use a unique key based on array index
        eventsByMessageId.set(`event-${events.indexOf(event)}`, event)
      }
    }

    const blocks = Array.from(eventsByMessageId.values()).flatMap(event => eventToBlocks(event))
    setContentBlocks(blocks)
  }, [events])

  return (
    <Box flexDirection="column" gap={1}>
      {contentBlocks.map(block =>
        block.type === "text" ?
          <StreamingText key={block.id} content={block.content} />
        : <ToolUse key={block.id} name={block.name} arg={block.arg} />,
      )}
    </Box>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
}
