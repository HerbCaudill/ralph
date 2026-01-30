/**
 * Reusable event factory functions for Storybook stories.
 */

import type { ChatEvent } from "../src/types"

const baseTimestamp = Date.now()

/** Create a user message event. */
export function createUserMessageEvent(
  /** The message text */
  message: string,
  /** Timestamp offset in ms from base (larger = earlier) */
  offset: number = 0,
): ChatEvent {
  return {
    type: "user_message",
    timestamp: baseTimestamp - offset,
    message,
  }
}

/** Create an assistant text event. */
export function createAssistantTextEvent(
  /** The assistant's text response */
  text: string,
  /** Timestamp offset in ms from base (larger = earlier) */
  offset: number = 0,
): ChatEvent {
  return {
    type: "assistant",
    timestamp: baseTimestamp - offset,
    message: {
      content: [{ type: "text", text }],
    },
  }
}

/** Create a tool use event within an assistant message. */
export function createToolUseEvent(
  /** Tool name (e.g. "Bash", "Read") */
  name: string,
  /** Tool input parameters */
  input: Record<string, unknown>,
  /** Timestamp offset in ms from base (larger = earlier) */
  offset: number = 0,
): ChatEvent {
  return {
    type: "assistant",
    timestamp: baseTimestamp - offset,
    message: {
      content: [
        {
          type: "tool_use",
          id: `toolu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name,
          input,
        },
      ],
    },
  }
}

/** Create a tool result event. */
export function createToolResultEvent(
  /** The tool_use_id this result corresponds to */
  toolUseId: string,
  /** The result content */
  content: string,
  /** Whether this is an error result */
  isError: boolean = false,
  /** Timestamp offset in ms from base (larger = earlier) */
  offset: number = 0,
): ChatEvent {
  return {
    type: "user",
    timestamp: baseTimestamp - offset,
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content,
          is_error: isError,
        },
      ],
    },
  }
}

/** Create an error event. */
export function createErrorEvent(
  /** The error message */
  error: string,
  /** Timestamp offset in ms from base (larger = earlier) */
  offset: number = 0,
): ChatEvent {
  return {
    type: "error",
    timestamp: baseTimestamp - offset,
    error,
  }
}

/** The base timestamp used by all factory functions. */
export { baseTimestamp }
