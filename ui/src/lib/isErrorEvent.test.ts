import { describe, it, expect } from "vitest"
import { isErrorEvent } from "./isErrorEvent"

describe("isErrorEvent", () => {
  it("returns true for error event with error string", () => {
    expect(
      isErrorEvent({
        type: "error",
        timestamp: 123,
        error: "Something went wrong",
      }),
    ).toBe(true)
  })

  it("returns true for server_error event with error string", () => {
    expect(
      isErrorEvent({
        type: "server_error",
        timestamp: 123,
        error: "Ralph is not running",
      }),
    ).toBe(true)
  })

  it("returns false for error event without error string", () => {
    expect(
      isErrorEvent({
        type: "error",
        timestamp: 123,
      }),
    ).toBe(false)
  })

  it("returns false for non-error event types", () => {
    expect(
      isErrorEvent({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(false)
  })

  it("returns false for assistant message event", () => {
    expect(
      isErrorEvent({
        type: "assistant_message",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })
})
