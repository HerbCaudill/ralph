import { describe, it, expect } from "vitest"
import { isStreamEvent } from "./isStreamEvent"

describe("isStreamEvent", () => {
  it("returns true for stream_event", () => {
    expect(
      isStreamEvent({
        type: "stream_event",
        timestamp: 123,
      }),
    ).toBe(true)
  })

  it("returns true for stream_event with event payload", () => {
    expect(
      isStreamEvent({
        type: "stream_event",
        timestamp: 123,
        event: { type: "content_block_delta" },
      }),
    ).toBe(true)
  })

  it("returns false for non-stream event types", () => {
    expect(
      isStreamEvent({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(false)
  })

  it("returns false for assistant event", () => {
    expect(
      isStreamEvent({
        type: "assistant",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })

  it("returns false for error event", () => {
    expect(
      isStreamEvent({
        type: "error",
        timestamp: 123,
        error: "Something went wrong",
      }),
    ).toBe(false)
  })
})
