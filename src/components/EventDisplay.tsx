import React, { useState, useEffect } from "react"
import { Box, Static } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"

export const EventDisplay = ({ events }: Props) => {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])

  useEffect(() => {
    // Filter to only show complete assistant messages, not streaming events
    // streaming events are incomplete and cause duplicate/disappearing content
    const assistantEvents = events.filter(event => event.type === "assistant")

    // Group by message ID and merge content from all versions
    // The Claude CLI sends multiple snapshots of the same message as it builds up
    const messageMap = new Map<string, Array<Record<string, unknown>>>()
    for (const event of assistantEvents) {
      const message = event.message as Record<string, unknown> | undefined
      const messageId = message?.id as string | undefined
      const content = message?.content as Array<Record<string, unknown>> | undefined

      if (messageId && content) {
        if (!messageMap.has(messageId)) {
          messageMap.set(messageId, [])
        }
        // Collect all content blocks from all versions
        messageMap.get(messageId)!.push(...content)
      }
    }

    // Create merged events with all content
    const mergedEvents = Array.from(messageMap.entries()).map(([messageId, allContent]) => {
      // Deduplicate content blocks by their ID (for tool_use) or text (for text blocks)
      const seenBlocks = new Set<string>()
      const uniqueContent: Array<Record<string, unknown>> = []

      for (const block of allContent) {
        const blockType = block.type as string
        let blockKey: string

        if (blockType === "tool_use") {
          blockKey = block.id as string
        } else if (blockType === "text") {
          blockKey = `text:${block.text}`
        } else {
          blockKey = JSON.stringify(block)
        }

        if (!seenBlocks.has(blockKey)) {
          seenBlocks.add(blockKey)
          uniqueContent.push(block)
        }
      }

      return {
        type: "assistant",
        message: {
          id: messageId,
          content: uniqueContent,
        },
      }
    })

    const blocks = mergedEvents.flatMap(event => eventToBlocks(event))
    setContentBlocks(blocks)
  }, [events])

  // Use Static to render content permanently to the scrollback buffer.
  // This prevents re-rendering of completed content and allows
  // natural terminal scrolling behavior.
  return (
    <Static items={contentBlocks}>
      {(block, index) => (
        <Box key={block.id} marginTop={index > 0 ? 1 : 0}>
          {block.type === "text" ?
            <StreamingText content={block.content} />
          : <ToolUse name={block.name} arg={block.arg} />}
        </Box>
      )}
    </Static>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
}
