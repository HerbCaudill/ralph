import { useMemo } from "react"
import type { RalphEvent } from "@/store"

// Types for streaming content blocks
export interface StreamingTextBlock {
  type: "text"
  text: string
}

export interface StreamingToolUseBlock {
  type: "tool_use"
  id: string
  name: string
  input: string // Partial JSON being built up
}

export type StreamingContentBlock = StreamingTextBlock | StreamingToolUseBlock

export interface StreamingMessage {
  timestamp: number
  contentBlocks: StreamingContentBlock[]
}

interface StreamState {
  currentMessage: StreamingMessage | null
  currentBlockIndex: number
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
    }

    for (const event of events) {
      if (event.type !== "stream_event") {
        // Non-stream events pass through directly
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
