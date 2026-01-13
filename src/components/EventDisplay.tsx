import React, { useMemo } from "react"
import { Box, Text } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"

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

// Render a single content block
const ContentBlockView = ({ block }: { block: ContentBlock }) => {
  if (block.type === "text") {
    return <StreamingText content={block.content} />
  }
  return <ToolUse name={block.name} arg={block.arg} />
}

// Render an iteration header
const IterationHeader = ({ iteration }: { iteration: number }) => (
  <Box marginTop={1}>
    <Text color="cyan" bold>
      ─── Iteration {iteration} ───
    </Text>
  </Box>
)

export const EventDisplay = ({ events, iteration, completedIterations }: Props) => {
  // Process completed iterations
  const completedContent = useMemo(() => {
    return completedIterations.map(completed => ({
      iteration: completed.iteration,
      blocks: processEvents(completed.events),
    }))
  }, [completedIterations])

  // Process current iteration events
  const currentBlocks = useMemo(() => processEvents(events), [events])

  return (
    <Box flexDirection="column">
      {/* Completed iterations */}
      {completedContent.map(({ iteration: iter, blocks }) => (
        <Box key={`iteration-${iter}`} flexDirection="column">
          <IterationHeader iteration={iter} />
          {blocks.map((block, index) => (
            <Box key={`iter${iter}-${block.id}`} marginTop={index > 0 ? 1 : 0}>
              <ContentBlockView block={block} />
            </Box>
          ))}
        </Box>
      ))}

      {/* Current iteration */}
      <Box flexDirection="column">
        <IterationHeader iteration={iteration} />
        {currentBlocks.map((block, index) => (
          <Box key={`iter${iteration}-${block.id}`} marginTop={index > 0 ? 1 : 0}>
            <ContentBlockView block={block} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
  iteration: number
  completedIterations: IterationEvents[]
}
