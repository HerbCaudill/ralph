import React, { useMemo } from "react"
import { Box, Text } from "ink"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"
import { formatContentBlock, formatIterationHeader } from "../lib/formatContentBlock.js"

type IterationEvents = {
  iteration: number
  events: Array<Record<string, unknown>>
}

// Process raw events into content blocks
const processEvents = (events: Array<Record<string, unknown>>): ContentBlock[] => {
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

  return mergedEvents.flatMap(event => eventToBlocks(event))
}

// Convert content blocks to lines of formatted text
const blocksToLines = (blocks: ContentBlock[]): string[] => {
  const lines: string[] = []
  for (let i = 0; i < blocks.length; i++) {
    // Add blank line between blocks (except before first)
    if (i > 0) {
      lines.push("")
    }
    const blockLines = formatContentBlock(blocks[i])
    lines.push(...blockLines)
  }
  return lines
}

export const EventDisplay = ({ events, iteration, completedIterations, height }: Props) => {
  // Convert all content to lines for virtual scrolling
  const allLines = useMemo(() => {
    const lines: string[] = []

    // Add completed iterations
    for (const completed of completedIterations) {
      lines.push("")
      lines.push(formatIterationHeader(completed.iteration))
      const blocks = processEvents(completed.events)
      lines.push(...blocksToLines(blocks))
    }

    // Add current iteration
    lines.push("")
    lines.push(formatIterationHeader(iteration))
    const currentBlocks = processEvents(events)
    lines.push(...blocksToLines(currentBlocks))

    return lines
  }, [events, iteration, completedIterations])

  // Calculate visible lines (auto-scroll to bottom)
  const visibleLines = useMemo(() => {
    if (!height || allLines.length <= height) {
      return allLines
    }
    return allLines.slice(-height)
  }, [allLines, height])

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, index) => (
        <Text key={index} wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
  iteration: number
  completedIterations: IterationEvents[]
  height?: number
}
