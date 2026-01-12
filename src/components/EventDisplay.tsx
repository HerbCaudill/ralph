import React, { useState, useEffect } from "react"
import { Box } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"

export const EventDisplay = ({ events }: Props) => {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])

  useEffect(() => {
    // Filter to only show complete assistant messages, not streaming events
    // streaming events are incomplete and cause duplicate/disappearing content
    const assistantEvents = events.filter(event => event.type === "assistant")

    // Deduplicate by message ID, keeping only the latest version
    const eventsByMessageId = new Map<string, Record<string, unknown>>()
    for (const event of assistantEvents) {
      const message = event.message as Record<string, unknown> | undefined
      const messageId = message?.id as string | undefined
      if (messageId) {
        eventsByMessageId.set(messageId, event)
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
