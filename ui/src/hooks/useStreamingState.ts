import { useMemo } from "react"
import type {
  AssistantChatEvent,
  ChatEvent,
  StreamingContentBlock,
  StreamingMessage,
} from "@/types"
import { isStreamEvent } from "@/lib/isStreamEvent"

/**
 * Maximum time (in ms) between a message_stop timestamp and an assistant event timestamp
 * for them to be considered duplicates when message IDs are not available.
 *
 * This handles the case where an assistant event arrives shortly after message_stop
 * for the same message. 1 second is generous for network jitter while unlikely to
 * cause false positives with separate messages.
 *
 * Why this exists: Legacy streaming data and some SDK versions may not include message
 * IDs in stream events. This timestamp-based fallback ensures backwards compatibility
 * and handles edge cases where IDs are missing.
 */
const COMPLETED_MESSAGE_DEDUP_THRESHOLD_MS = 1000

/**
 * Maximum time (in ms) for an in-progress streaming message before it's considered
 * stale for deduplication purposes.
 *
 * If an assistant event arrives more than 30 seconds after message_start without
 * a corresponding message_stop, we assume the streaming message was interrupted
 * and the assistant event is a new message, not a duplicate.
 *
 * This timeout is intentionally long to handle slow responses with extended thinking,
 * tool use chains, or network interruptions that delay message_stop.
 */
const IN_PROGRESS_MESSAGE_TIMEOUT_MS = 30000

/**
 * Tracks accumulated text for each content block during streaming.
 * Uses string arrays instead of concatenation for efficient accumulation,
 * and produces final strings only when needed (at block/message completion).
 */
interface BlockAccumulator {
  type: "text" | "thinking" | "tool_use"
  /** For text blocks: accumulated text fragments */
  textFragments?: string[]
  /** For thinking blocks: accumulated thinking fragments */
  thinkingFragments?: string[]
  /** For tool_use blocks: accumulated JSON fragments */
  inputFragments?: string[]
  /** For tool_use blocks: stable ID and name */
  id?: string
  name?: string
  /** Initial text from content_block_start (may be non-empty) */
  initialText?: string
  initialThinking?: string
}

interface StreamState {
  currentMessage: {
    timestamp: number
    accumulators: BlockAccumulator[]
  } | null
  currentBlockIndex: number
}

/**
 * Resolves a BlockAccumulator into a finalized StreamingContentBlock.
 * Joins accumulated fragments into final strings.
 */
function resolveAccumulator(acc: BlockAccumulator): StreamingContentBlock {
  switch (acc.type) {
    case "text":
      return {
        type: "text",
        text: (acc.initialText || "") + (acc.textFragments?.join("") || ""),
      }
    case "thinking":
      return {
        type: "thinking",
        thinking: (acc.initialThinking || "") + (acc.thinkingFragments?.join("") || ""),
      }
    case "tool_use":
      return {
        type: "tool_use",
        id: acc.id!,
        name: acc.name!,
        input: acc.inputFragments?.join("") || "",
      }
  }
}

/**
 * Find streaming message ranges from message_start/message_stop pairs.
 * This is used to deduplicate SDK assistant events that correspond to streamed messages.
 *
 * Returns:
 * - completedMessageRanges: Array of {start, stop, id?} for completed streaming messages
 * - inProgressStartTimestamp: The start timestamp of any currently in-progress message (no message_stop yet)
 * - synthesizedMessageIds: Set of message IDs that were synthesized from streaming
 */
function findStreamingMessageRanges(events: ChatEvent[]): {
  completedMessageRanges: Array<{ start: number; stop: number; id?: string }>
  inProgressStartTimestamp: number | null
  inProgressMessageId: string | null
  synthesizedMessageIds: Set<string>
} {
  const completedMessageRanges: Array<{ start: number; stop: number; id?: string }> = []
  const synthesizedMessageIds = new Set<string>()
  let currentMessageStartTimestamp: number | null = null
  let currentMessageId: string | null = null

  for (const event of events) {
    if (!isStreamEvent(event)) continue
    const streamEvent = event.event
    if (!streamEvent) continue

    if (streamEvent.type === "message_start") {
      currentMessageStartTimestamp = event.timestamp
      // Extract message ID if available
      currentMessageId = streamEvent.message?.id ?? null
    } else if (streamEvent.type === "message_stop" && currentMessageStartTimestamp !== null) {
      completedMessageRanges.push({
        start: currentMessageStartTimestamp,
        stop: event.timestamp,
        id: currentMessageId ?? undefined,
      })
      // Track that this message ID was synthesized
      if (currentMessageId) {
        synthesizedMessageIds.add(currentMessageId)
      }
      currentMessageStartTimestamp = null
      currentMessageId = null
    }
  }

  return {
    completedMessageRanges,
    inProgressStartTimestamp: currentMessageStartTimestamp,
    inProgressMessageId: currentMessageId,
    synthesizedMessageIds,
  }
}

/**
 * Check if an assistant event should be deduplicated because it corresponds to
 * a streamed message.
 *
 * Deduplication strategy (in priority order):
 *
 * 1. **Message ID matching (most reliable)**: If the assistant event's message.id
 *    matches a message ID we've seen in streaming (either completed or in-progress),
 *    it's definitely a duplicate.
 *
 * 2. **Timestamp proximity fallback (for legacy data)**: When message IDs aren't
 *    available (legacy SDK versions, missing data), we fall back to timestamp matching:
 *    - For completed streams: assistant event within COMPLETED_MESSAGE_DEDUP_THRESHOLD_MS
 *      of message_stop is considered a duplicate
 *    - For in-progress streams: assistant event that arrives after message_start but
 *      before message_stop (or within IN_PROGRESS_MESSAGE_TIMEOUT_MS) is a duplicate
 *
 * The timestamp fallback is imperfect but necessary for backwards compatibility.
 * It may have false positives (deduplicating unrelated messages that happen to be
 * close in time) or false negatives (failing to deduplicate if network delays push
 * timestamps beyond thresholds). The ID-based approach is always preferred.
 *
 * @see https://github.com/anthropics/claude-code/issues/XXXX for context on why
 * streaming generates both stream events and assistant events
 */
function shouldDeduplicateAssistant(
  assistantEvent: ChatEvent,
  completedMessageRanges: Array<{ start: number; stop: number; id?: string }>,
  inProgressStartTimestamp: number | null,
  inProgressMessageId: string | null,
  synthesizedMessageIds: Set<string>,
): boolean {
  // Extract message ID from the assistant event if available
  const messageId = (assistantEvent as AssistantChatEvent).message?.id

  // Priority 1: Check by message ID (most reliable)
  // This covers completed streaming messages where we extracted the ID from message_start
  if (messageId && synthesizedMessageIds.has(messageId)) {
    return true
  }

  // Priority 2: Check if this assistant's message ID matches an in-progress stream
  // This handles the case where assistant event arrives before message_stop
  if (messageId && inProgressMessageId && messageId === inProgressMessageId) {
    return true
  }

  // Priority 3: Check by message ID against completed ranges (handles out-of-order events)
  // An assistant event might arrive with a message ID that matches a completed range's ID
  if (messageId) {
    for (const range of completedMessageRanges) {
      if (range.id && range.id === messageId) {
        return true
      }
    }
  }

  // Fallback: Timestamp-based deduplication for messages without IDs
  // This is less reliable but necessary for backwards compatibility with legacy data
  // that doesn't include message IDs in stream events.
  const assistantTimestamp = assistantEvent.timestamp

  // Check if this assistant is within threshold of any completed streaming message's stop
  for (const range of completedMessageRanges) {
    // Only use timestamp fallback if the range doesn't have an ID (legacy data)
    // If it has an ID and we didn't match above, they're different messages
    if (range.id) {
      continue
    }
    const diff = Math.abs(assistantTimestamp - range.stop)
    if (diff < COMPLETED_MESSAGE_DEDUP_THRESHOLD_MS) {
      return true
    }
  }

  // Check if there's an in-progress streaming message (without ID) that started before
  // this assistant. Only use timestamp fallback if we don't have an ID to match.
  if (
    inProgressStartTimestamp !== null &&
    inProgressMessageId === null && // Only fallback if no ID available
    inProgressStartTimestamp <= assistantTimestamp &&
    assistantTimestamp - inProgressStartTimestamp < IN_PROGRESS_MESSAGE_TIMEOUT_MS
  ) {
    return true
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
    // First pass: find streaming message ranges and message IDs
    const {
      completedMessageRanges,
      inProgressStartTimestamp,
      inProgressMessageId,
      synthesizedMessageIds,
    } = findStreamingMessageRanges(events)

    const completedEvents: ChatEvent[] = []
    const state: StreamState = {
      currentMessage: null,
      currentBlockIndex: -1,
    }

    for (const event of events) {
      if (!isStreamEvent(event)) {
        // Non-stream events pass through directly, but skip assistant events that
        // were already synthesized from streaming (to avoid duplicates).
        // Deduplication uses message IDs (when available) or timestamp proximity as fallback.
        if (event.type === "assistant") {
          if (
            shouldDeduplicateAssistant(
              event,
              completedMessageRanges,
              inProgressStartTimestamp,
              inProgressMessageId,
              synthesizedMessageIds,
            )
          ) {
            // Skip - this is a duplicate of a streamed message
            continue
          }
        }
        completedEvents.push(event)
        continue
      }

      const streamEvent = event.event
      if (!streamEvent) continue

      switch (streamEvent.type) {
        case "message_start":
          // Start a new streaming message with fresh accumulators
          state.currentMessage = {
            timestamp: event.timestamp,
            accumulators: [],
          }
          state.currentBlockIndex = -1
          break

        case "content_block_start":
          if (state.currentMessage && streamEvent.content_block) {
            const block = streamEvent.content_block
            if (block.type === "text") {
              state.currentMessage.accumulators.push({
                type: "text",
                initialText: block.text || "",
                textFragments: [],
              })
            } else if (block.type === "thinking") {
              state.currentMessage.accumulators.push({
                type: "thinking",
                initialThinking: block.thinking || "",
                thinkingFragments: [],
              })
            } else if (block.type === "tool_use") {
              state.currentMessage.accumulators.push({
                type: "tool_use",
                id: block.id,
                name: block.name,
                inputFragments: [],
              })
            }
            state.currentBlockIndex = state.currentMessage.accumulators.length - 1
          }
          break

        case "content_block_delta":
          // Append delta fragments to the accumulator (push to array, no mutation of existing strings)
          if (state.currentMessage && state.currentBlockIndex >= 0) {
            const acc = state.currentMessage.accumulators[state.currentBlockIndex]
            const delta = streamEvent.delta

            if (delta?.type === "text_delta" && acc.type === "text") {
              acc.textFragments!.push(delta.text || "")
            } else if (delta?.type === "thinking_delta" && acc.type === "thinking") {
              acc.thinkingFragments!.push(delta.thinking || "")
            } else if (delta?.type === "input_json_delta" && acc.type === "tool_use") {
              acc.inputFragments!.push(delta.partial_json || "")
            }
          }
          break

        case "content_block_stop":
          // Block is complete, nothing special to do
          break

        case "message_stop":
          // Message is complete - resolve accumulators and convert to a regular assistant event
          if (state.currentMessage && state.currentMessage.accumulators.length > 0) {
            const content = state.currentMessage.accumulators.map(acc => {
              const resolved = resolveAccumulator(acc)
              if (resolved.type === "text") {
                return { type: "text" as const, text: resolved.text }
              } else if (resolved.type === "thinking") {
                return { type: "thinking" as const, thinking: resolved.thinking }
              } else {
                // tool_use block - parse the accumulated JSON input
                let input = {}
                try {
                  input = JSON.parse(resolved.input)
                } catch {
                  // Partial JSON, keep empty
                }
                return {
                  type: "tool_use" as const,
                  id: resolved.id,
                  name: resolved.name,
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

    // Resolve accumulators into content blocks for any in-progress streaming message
    const streamingMessage: StreamingMessage | null =
      state.currentMessage ?
        {
          timestamp: state.currentMessage.timestamp,
          contentBlocks: state.currentMessage.accumulators.map(resolveAccumulator),
        }
      : null

    return {
      completedEvents,
      streamingMessage,
    }
  }, [events])
}
