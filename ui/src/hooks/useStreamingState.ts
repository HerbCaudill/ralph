import { useMemo } from "react"
import type { ChatEvent, StreamingMessage } from "@/types"

interface StreamState {
  currentMessage: StreamingMessage | null
  currentBlockIndex: number
}

/**
 * Find all message_start/message_stop pairs in the events to build a set of
 * streaming message timestamp ranges. This is used to deduplicate SDK assistant
 * events that correspond to streamed messages.
 *
 * Returns a Set of message_stop timestamps that have corresponding streaming content.
 */
function findStreamingMessageStopTimestamps(events: ChatEvent[]): Set<number> {
  const messageStopTimestamps = new Set<number>()
  let hasCurrentMessage = false

  for (const event of events) {
    if (event.type !== "stream_event") continue
    const streamEvent = (event as { event?: { type?: string } }).event
    if (!streamEvent) continue

    if (streamEvent.type === "message_start") {
      hasCurrentMessage = true
    } else if (streamEvent.type === "message_stop" && hasCurrentMessage) {
      messageStopTimestamps.add(event.timestamp)
      hasCurrentMessage = false
    }
  }

  return messageStopTimestamps
}

/**
 * Check if an assistant event should be deduplicated because it corresponds to
 * a streamed message. An assistant event is a duplicate if there's a message_stop
 * event within 1000ms before or after it.
 */
function shouldDeduplicateAssistant(
  assistantTimestamp: number,
  messageStopTimestamps: Set<number>,
): boolean {
  for (const stopTimestamp of messageStopTimestamps) {
    const diff = Math.abs(assistantTimestamp - stopTimestamp)
    if (diff < 1000) {
      return true
    }
  }
  return false
}

/**
 * Processes events and extracts the current streaming state.
 * Returns both completed events (for normal rendering) and
 * any in-progress streaming content.
 */
export function useStreamingState(events: ChatEvent[]): {
  completedEvents: ChatEvent[]
  streamingMessage: StreamingMessage | null
} {
  return useMemo(() => {
    // First pass: find all message_stop timestamps from streaming messages
    const messageStopTimestamps = findStreamingMessageStopTimestamps(events)

    const completedEvents: ChatEvent[] = []
    const state: StreamState = {
      currentMessage: null,
      currentBlockIndex: -1,
    }

    for (const event of events) {
      if (event.type !== "stream_event") {
        // Non-stream events pass through directly, but skip assistant events that
        // were already synthesized from streaming (to avoid duplicates).
        // We check if there's a message_stop event nearby (within 1000ms) to detect duplicates.
        if (event.type === "assistant") {
          if (shouldDeduplicateAssistant(event.timestamp, messageStopTimestamps)) {
            // Skip - this is a duplicate of a streamed message
            continue
          }
        }
        completedEvents.push(event)
        continue
      }

      const streamEvent = (event as any).event
      if (!streamEvent) continue

      switch (streamEvent.type) {
        case "message_start":
          // Start a new streaming message
          state.currentMessage = {
            timestamp: event.timestamp,
            contentBlocks: [],
          }
          state.currentBlockIndex = -1
          break

        case "content_block_start":
          if (state.currentMessage && streamEvent.content_block) {
            const block = streamEvent.content_block
            if (block.type === "text") {
              state.currentMessage.contentBlocks.push({
                type: "text",
                text: block.text || "",
              })
            } else if (block.type === "tool_use") {
              state.currentMessage.contentBlocks.push({
                type: "tool_use",
                id: block.id,
                name: block.name,
                input: "",
              })
            }
            state.currentBlockIndex = state.currentMessage.contentBlocks.length - 1
          }
          break

        case "content_block_delta":
          if (state.currentMessage && state.currentBlockIndex >= 0) {
            const block = state.currentMessage.contentBlocks[state.currentBlockIndex]
            const delta = streamEvent.delta

            if (delta?.type === "text_delta" && block.type === "text") {
              block.text += delta.text || ""
            } else if (delta?.type === "input_json_delta" && block.type === "tool_use") {
              block.input += delta.partial_json || ""
            }
          }
          break

        case "content_block_stop":
          // Block is complete, nothing special to do
          break

        case "message_stop":
          // Message is complete - convert to a regular assistant event
          if (state.currentMessage && state.currentMessage.contentBlocks.length > 0) {
            const content = state.currentMessage.contentBlocks.map(block => {
              if (block.type === "text") {
                return { type: "text" as const, text: block.text }
              } else {
                // Parse the accumulated JSON input
                let input = {}
                try {
                  input = JSON.parse(block.input)
                } catch {
                  // Partial JSON, keep empty
                }
                return {
                  type: "tool_use" as const,
                  id: block.id,
                  name: block.name,
                  input,
                }
              }
            })

            completedEvents.push({
              type: "assistant",
              timestamp: state.currentMessage.timestamp,
              message: { content },
            })
          }
          state.currentMessage = null
          state.currentBlockIndex = -1
          break

        case "message_delta":
          // Contains stop_reason, usage info - ignore for now
          break
      }
    }

    return {
      completedEvents,
      streamingMessage: state.currentMessage,
    }
  }, [events])
}
