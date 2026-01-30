import { eventToBlocks, type ContentBlock } from "../components/eventToBlocks.js"

/**
 * Process raw events into content blocks.
 *
 * With includePartialMessages: true, we receive multiple snapshots of the same message
 * as it builds up. Each snapshot may contain different parts of the message content,
 * so we need to merge them and deduplicate.
 */
export const processEvents = (
  /** Array of raw event objects from the SDK */
  events: Array<Record<string, unknown>>,
): ContentBlock[] => {
  const blocks: ContentBlock[] = []

  // First pass: collect all assistant message content and track message order
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
              const idx = uniqueContent.findIndex(b => b.type === "text" && b.text === seenText)
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

  const assistantBlocks = mergedEvents.flatMap(event => eventToBlocks(event))

  // Second pass: process events in order, including user messages
  // Track which user messages and assistant messages we've already seen
  const processedUserIds = new Set<string>()
  const processedAssistantIds = new Set<string>()

  for (const event of events) {
    if (event.type === "user") {
      const message = event.message as Record<string, unknown> | undefined
      const messageId = (message?.id as string | undefined) ?? `user-${Date.now()}`
      if (!processedUserIds.has(messageId)) {
        processedUserIds.add(messageId)
        blocks.push(...eventToBlocks(event))
      }
    } else if (event.type === "assistant") {
      const message = event.message as Record<string, unknown> | undefined
      const messageId = message?.id as string | undefined
      if (messageId && !processedAssistantIds.has(messageId)) {
        processedAssistantIds.add(messageId)
        // Find the merged version of this message
        const merged = assistantBlocks.filter(b => b.id.startsWith(messageId))
        blocks.push(...merged)
      }
    }
  }

  return blocks
}
