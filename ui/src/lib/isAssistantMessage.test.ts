import { describe, it, expect } from "vitest"
import { isAssistantMessage } from "./isAssistantMessage"

describe("isAssistantMessage", () => {
  it("returns true for assistant event with message object", () => {
    expect(
      isAssistantMessage({
        type: "assistant",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(true)
  })

  it("returns true for assistant event with populated content", () => {
    expect(
      isAssistantMessage({
        type: "assistant",
        timestamp: 123,
        message: { content: [{ type: "text", text: "Hello" }] },
      }),
    ).toBe(true)
  })

  it("returns false for assistant event without message", () => {
    expect(
      isAssistantMessage({
        type: "assistant",
        timestamp: 123,
      }),
    ).toBe(false)
  })

  it("returns false for assistant event with non-object message", () => {
    expect(
      isAssistantMessage({
        type: "assistant",
        timestamp: 123,
        message: "plain string",
      }),
    ).toBe(false)
  })

  it("returns false for non-assistant event types", () => {
    expect(
      isAssistantMessage({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(false)
  })

  it("returns false for error event", () => {
    expect(
      isAssistantMessage({
        type: "error",
        timestamp: 123,
        error: "Something went wrong",
      }),
    ).toBe(false)
  })
})
