import { describe, it, expect } from "vitest"
import { isUserMessageEvent } from "./isUserMessageEvent"

describe("isUserMessageEvent", () => {
  it("returns true for user_message event with string message", () => {
    expect(
      isUserMessageEvent({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(true)
  })

  it("returns true for user_message event with empty string message", () => {
    expect(
      isUserMessageEvent({
        type: "user_message",
        timestamp: 123,
        message: "",
      }),
    ).toBe(true)
  })

  it("returns false for user_message event without message", () => {
    expect(
      isUserMessageEvent({
        type: "user_message",
        timestamp: 123,
      }),
    ).toBe(false)
  })

  it("returns false for user_message event with non-string message", () => {
    expect(
      isUserMessageEvent({
        type: "user_message",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })

  it("returns false for non-user_message event types", () => {
    expect(
      isUserMessageEvent({
        type: "assistant",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })

  it("returns false for user event (not user_message)", () => {
    expect(
      isUserMessageEvent({
        type: "user",
        timestamp: 123,
        tool_use_result: "result",
      }),
    ).toBe(false)
  })
})
