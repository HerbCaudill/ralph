import { describe, it, expect } from "vitest"
import { isAssistantMessage } from "./isAssistantMessage"
import type { ChatEvent } from "../types"

describe("isAssistantMessage", () => {
  it("should return true for assistant event with message object", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      message: { content: [] },
    }

    expect(isAssistantMessage(event)).toBe(true)
  })

  it("should return false for assistant event without message", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
    }

    expect(isAssistantMessage(event)).toBe(false)
  })

  it("should return false for assistant event with non-object message", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      message: "string message" as any,
    }

    expect(isAssistantMessage(event)).toBe(false)
  })

  it("should return false for non-assistant event", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      message: { content: [] },
    }

    expect(isAssistantMessage(event)).toBe(false)
  })

  it("should return false for user_message event", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: "text",
    }

    expect(isAssistantMessage(event)).toBe(false)
  })

  it("should return false for error event", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: "An error occurred",
    }

    expect(isAssistantMessage(event)).toBe(false)
  })

  it("should handle null message", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      message: null as any,
    }

    // In JavaScript, typeof null === "object", so this returns true
    expect(isAssistantMessage(event)).toBe(true)
  })

  it("should handle undefined message", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      message: undefined,
    }

    expect(isAssistantMessage(event)).toBe(false)
  })
})
