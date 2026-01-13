import React, { useMemo } from "react"
import { Box, Static, Text, useStdout } from "ink"
import { StreamingText } from "./StreamingText.js"
import { ToolUse } from "./ToolUse.js"
import { Header } from "./Header.js"
import { eventToBlocks, type ContentBlock } from "./eventToBlocks.js"

type IterationEvents = {
  iteration: number
  events: Array<Record<string, unknown>>
}

type StaticItem =
  | { type: "app-header"; id: string; claudeVersion: string; ralphVersion: string; width: number }
  | { type: "iteration-header"; id: string; iteration: number; width: number }
  | ContentBlock

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

export const EventDisplay = ({
  events,
  iteration,
  completedIterations,
  claudeVersion,
  ralphVersion,
}: Props) => {
  const { stdout } = useStdout()
  // Account for the marginX={1} in App.tsx (2 chars total)
  const terminalWidth = (stdout?.columns ?? 80) - 2

  // Build static items for completed iterations only
  // Current iteration is rendered separately to ensure proper ordering
  const staticItems = useMemo((): StaticItem[] => {
    const items: StaticItem[] = [
      { type: "app-header", id: "app-header", claudeVersion, ralphVersion, width: terminalWidth },
    ]

    // Add completed iterations and their content
    for (const completed of completedIterations) {
      items.push({
        type: "iteration-header",
        id: `iteration-${completed.iteration}`,
        iteration: completed.iteration,
        width: terminalWidth,
      })
      const blocks = processEvents(completed.events)
      for (const block of blocks) {
        // Prefix block IDs with iteration number to ensure uniqueness
        items.push({
          ...block,
          id: `iter${completed.iteration}-${block.id}`,
        })
      }
    }

    return items
  }, [completedIterations, claudeVersion, ralphVersion, terminalWidth])

  // Process current iteration events
  const currentBlocks = useMemo(() => processEvents(events), [events])

  // Use Static to render completed iterations permanently to the scrollback buffer.
  // Current iteration is rendered normally below to ensure headers appear correctly.
  // Note: We use a fragment to avoid wrapper Box indentation issues with Static.
  return (
    <>
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

      {/* Current iteration - rendered outside Static to ensure header appears */}
      <Box flexDirection="column">
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          marginBottom={1}
          width={terminalWidth}
        >
          <Text color="cyan">Iteration {iteration}</Text>
        </Box>
        {currentBlocks.map((block, index) => (
          <Box key={`iter${iteration}-${block.id}`} marginTop={index > 0 ? 1 : 0}>
            {block.type === "text" ?
              <StreamingText content={block.content} />
            : <ToolUse name={block.name} arg={block.arg} />}
          </Box>
        ))}
      </Box>
    </>
  )
}

type Props = {
  events: Array<Record<string, unknown>>
  iteration: number
  completedIterations: IterationEvents[]
  claudeVersion: string
  ralphVersion: string
}
