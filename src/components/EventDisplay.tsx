import React, { useState, useEffect } from "react"
import { Box, Static, Text, useStdout } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { Header } from "./Header.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"

type StaticItem =
  | { type: "app-header"; id: string; claudeVersion: string; ralphVersion: string; width: number }
  | { type: "iteration-header"; id: string; iteration: number; width: number }
  | ContentBlock

export const EventDisplay = ({ events, iteration, claudeVersion, ralphVersion }: Props) => {
  const { stdout } = useStdout()
  // Account for the marginX={1} in App.tsx (2 chars total)
  const terminalWidth = (stdout?.columns ?? 80) - 2
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

  // Prepend headers as the first static items
  const staticItems: StaticItem[] = [
    { type: "app-header", id: "app-header", claudeVersion, ralphVersion, width: terminalWidth },
    { type: "iteration-header", id: `iteration-${iteration}`, iteration, width: terminalWidth },
    ...contentBlocks,
  ]

  // Use Static to render content permanently to the scrollback buffer.
  // This prevents re-rendering of completed content and allows
  // natural terminal scrolling behavior.
  return (
    <Static items={staticItems}>
      {(item, index) => {
        if (item.type === "app-header") {
          return (
            <Header
              key={item.id}
              claudeVersion={item.claudeVersion}
              ralphVersion={item.ralphVersion}
              width={item.width}
            />
          )
        }
        if (item.type === "iteration-header") {
          return (
            <Box
              key={item.id}
              borderStyle="round"
              borderColor="cyan"
              paddingX={1}
              marginBottom={1}
              width={item.width}
            >
              <Text color="cyan">Iteration {item.iteration}</Text>
            </Box>
          )
        }
        return (
          <Box key={item.id} marginTop={index > 2 ? 1 : 0}>
            {item.type === "text" ?
              <StreamingText content={item.content} />
            : <ToolUse name={item.name} arg={item.arg} />}
          </Box>
        )
      }}
    </Static>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
  iteration: number
  claudeVersion: string
  ralphVersion: string
}
