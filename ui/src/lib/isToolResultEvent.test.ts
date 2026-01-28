import { describe, it, expect } from "vitest"
import { isToolResultEvent } from "./isToolResultEvent"

describe("isToolResultEvent", () => {
  it("returns true for user event with tool_use_result", () => {
    expect(
      isToolResultEvent({
        type: "user",
        timestamp: 123,
        tool_use_result: { content: "result" },
      }),
    ).toBe(true)
  })

  it("returns true for user event with string tool_use_result", () => {
    expect(
      isToolResultEvent({
        type: "user",
        timestamp: 123,
        tool_use_result: "some result",
      }),
    ).toBe(true)
  })

  it("returns false for user event without tool_use_result", () => {
    expect(
      isToolResultEvent({
        type: "user",
        timestamp: 123,
      }),
    ).toBe(false)
  })

  it("returns false for non-user event types", () => {
    expect(
      isToolResultEvent({
        type: "assistant",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })

  it("returns false for user_message event", () => {
    expect(
      isToolResultEvent({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(false)
  })
})
