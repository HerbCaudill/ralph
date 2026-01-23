import { useMemo } from "react"
import type { RalphEvent, StreamingMessage } from "@/types"

interface StreamState {
  currentMessage: StreamingMessage | null
  currentBlockIndex: number
  /**
   * Timestamp of the last synthesized assistant event.
   * Used to deduplicate assistant events that come after message_stop.
   */
  lastSynthesizedTimestamp: number | null
}

/**
 * Processes events and extracts the current streaming state.
 * Returns both completed events (for normal rendering) and
 * any in-progress streaming content.
 */
export function useStreamingState(events: RalphEvent[]): {
  completedEvents: RalphEvent[]
  streamingMessage: StreamingMessage | null
} {
  return useMemo(() => {
    const completedEvents: RalphEvent[] = []
    const state: StreamState = {
      currentMessage: null,
      currentBlockIndex: -1,
      lastSynthesizedTimestamp: null,
    }

    for (const event of events) {
      if (event.type !== "stream_event") {
        // Non-stream events pass through directly, but skip assistant events that
        // were already synthesized from streaming (to avoid duplicates).
        // We detect duplicates by checking if we synthesized an assistant event
        // from message_stop that occurred shortly before this assistant event.
        if (event.type === "assistant" && state.lastSynthesizedTimestamp !== null) {
          // The SDK sends assistant event right after message_stop (typically within 100ms).
          // If we synthesized an assistant event recently, skip this duplicate.
          const timeSinceSynthesized = event.timestamp - state.lastSynthesizedTimestamp
          if (timeSinceSynthesized >= 0 && timeSinceSynthesized < 1000) {
            // Skip - we already created this from streaming
            // Clear the timestamp so we don't skip subsequent legitimate assistant events
            state.lastSynthesizedTimestamp = null
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
            // Record the timestamp so we can skip the duplicate assistant event
            // that the server sends after message_stop
            state.lastSynthesizedTimestamp = event.timestamp
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
