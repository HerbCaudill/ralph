import { describe, it, expect } from "vitest"
import { isStreamEvent } from "./isStreamEvent"
import type { ChatEvent } from "../types"

describe("isStreamEvent", () => {
  it("should return true for stream_event type", () => {
    const event: ChatEvent = {
      type: "stream_event",
      timestamp: 123,
      event: { type: "message_start" },
    }

    expect(isStreamEvent(event)).toBe(true)
  })

  it("should return true for stream_event without event payload", () => {
    const event: ChatEvent = {
      type: "stream_event",
      timestamp: 123,
    }

    expect(isStreamEvent(event)).toBe(true)
  })

  it("should return false for non-stream_event types", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      message: { content: [] },
    }

    expect(isStreamEvent(event)).toBe(false)
  })

  it("should return false for user event", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
    }

    expect(isStreamEvent(event)).toBe(false)
  })

  it("should return false for error event", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: "An error",
    }

    expect(isStreamEvent(event)).toBe(false)
  })

  it("should handle stream_event with complex payload", () => {
    const event: ChatEvent = {
      type: "stream_event",
      timestamp: 123,
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "hello" },
        content_block: { type: "text", id: "block-1" },
      },
    }

    expect(isStreamEvent(event)).toBe(true)
  })
})
