import React, { useMemo, useState, useEffect, useRef } from "react"
import { Box, Text, useInput } from "ink"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"
import { formatContentBlock, formatIterationHeader } from "../lib/formatContentBlock.js"

type IterationEvents = {
  iteration: number
  events: Array<Record<string, unknown>>
}

// Process raw events into content blocks
// With includePartialMessages: true, we receive multiple snapshots of the same message
// as it builds up. Each snapshot may contain different parts of the message content,
// so we need to merge them and deduplicate.
const processEvents = (events: Array<Record<string, unknown>>): ContentBlock[] => {
  // Filter to only show complete assistant messages, not streaming events
  // streaming events are incomplete and cause duplicate/disappearing content
  const assistantEvents = events.filter(event => event.type === "assistant")

  // Collect all content blocks from all snapshots of the same message
  const messageMap = new Map<string, Array<Record<string, unknown>>>()
  for (const event of assistantEvents) {
    const message = event.message as Record<string, unknown> | undefined
    const messageId = message?.id as string | undefined
    const content = message?.content as Array<Record<string, unknown>> | undefined

    if (messageId && content) {
      if (!messageMap.has(messageId)) {
        messageMap.set(messageId, [])
      }
      messageMap.get(messageId)!.push(...content)
    }
  }

  // Create merged events with deduplicated content
  const mergedEvents = Array.from(messageMap.entries()).map(([messageId, allContent]) => {
    // Deduplicate content blocks by their ID (for tool_use) or text (for text blocks)
    const seenBlocks = new Set<string>()
    const uniqueContent: Array<Record<string, unknown>> = []

    for (const block of allContent) {
      const blockType = block.type as string
      let blockKey: string

      if (blockType === "tool_use") {
        // Tool use blocks are unique by their ID
        blockKey = `tool:${block.id}`
      } else if (blockType === "text") {
        // For text blocks, check if this is a prefix of or prefixed by existing text
        // This handles incremental text updates where each snapshot has more content
        const text = block.text as string
        let isDuplicate = false

        for (const seenKey of seenBlocks) {
          if (seenKey.startsWith("text:")) {
            const seenText = seenKey.substring(5)
            // If existing text starts with this text, or this text starts with existing,
            // keep only the longer one
            if (seenText.startsWith(text)) {
              // Existing is longer, this is a duplicate
              isDuplicate = true
              break
            } else if (text.startsWith(seenText)) {
              // This is longer, remove the old one and add this
              seenBlocks.delete(seenKey)
              // Also remove from uniqueContent
              const idx = uniqueContent.findIndex(
                b => b.type === "text" && b.text === seenText,
              )
              if (idx >= 0) uniqueContent.splice(idx, 1)
              break
            }
          }
        }

        if (isDuplicate) continue
        blockKey = `text:${text}`
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
  for (const block of blocks) {
    const blockLines = formatContentBlock(block)
    lines.push(...blockLines)
    // Add blank line after each block
    lines.push("")
  }
  return lines
}

export const EventDisplay = ({ events, iteration, completedIterations, height }: Props) => {
  // Scroll offset from bottom (0 = at bottom, positive = scrolled up)
  const [scrollOffset, setScrollOffset] = useState(0)
  // Track if user has manually scrolled
  const userScrolledRef = useRef(false)
  // Track previous line count for auto-scroll
  const prevLineCountRef = useRef(0)

  // Convert all content to lines for virtual scrolling
  const allLines = useMemo(() => {
    const lines: string[] = []

    // Add completed iterations
    for (const completed of completedIterations) {
      lines.push("")
      lines.push("")
      lines.push(formatIterationHeader(completed.iteration))
      lines.push("")
      const blocks = processEvents(completed.events)
      lines.push(...blocksToLines(blocks))
    }

    // Add current iteration
    lines.push("")
    lines.push("")
    lines.push(formatIterationHeader(iteration))
    lines.push("")
    const currentBlocks = processEvents(events)
    lines.push(...blocksToLines(currentBlocks))

    return lines
  }, [events, iteration, completedIterations])

  // Auto-scroll to bottom when new content arrives (unless user scrolled up)
  useEffect(() => {
    if (allLines.length > prevLineCountRef.current && !userScrolledRef.current) {
      setScrollOffset(0)
    }
    prevLineCountRef.current = allLines.length
  }, [allLines.length])

  // Handle keyboard input for scrolling
  useInput((input, key) => {
    if (!height) return

    const maxOffset = Math.max(0, allLines.length - height)
    const pageSize = Math.max(1, height - 2)

    if (key.upArrow || input === "k") {
      userScrolledRef.current = true
      setScrollOffset(prev => Math.min(maxOffset, prev + 1))
    } else if (key.downArrow || input === "j") {
      const newOffset = Math.max(0, scrollOffset - 1)
      setScrollOffset(newOffset)
      if (newOffset === 0) {
        userScrolledRef.current = false
      }
    } else if (key.pageUp) {
      userScrolledRef.current = true
      setScrollOffset(prev => Math.min(maxOffset, prev + pageSize))
    } else if (key.pageDown) {
      const newOffset = Math.max(0, scrollOffset - pageSize)
      setScrollOffset(newOffset)
      if (newOffset === 0) {
        userScrolledRef.current = false
      }
    } else if (input === "g" && key.shift) {
      // Shift+G = go to bottom
      setScrollOffset(0)
      userScrolledRef.current = false
    } else if (input === "g") {
      // g = go to top
      userScrolledRef.current = true
      setScrollOffset(maxOffset)
    }
  })

  // Calculate visible lines based on scroll position
  const visibleLines = useMemo(() => {
    if (!height || allLines.length <= height) {
      return allLines
    }
    const endIndex = allLines.length - scrollOffset
    const startIndex = Math.max(0, endIndex - height)
    return allLines.slice(startIndex, endIndex)
  }, [allLines, height, scrollOffset])

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, index) => (
        <Text key={index} wrap="wrap">
          {line || " "}
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
