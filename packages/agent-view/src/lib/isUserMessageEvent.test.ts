import { describe, it, expect } from "vitest"
import { isUserMessageEvent } from "./isUserMessageEvent"
import type { ChatEvent } from "../types"

describe("isUserMessageEvent", () => {
  it("should return true for user_message type with string message", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: "Hello, assistant!",
    }

    expect(isUserMessageEvent(event)).toBe(true)
  })

  it("should return true for empty string message", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: "",
    }

    expect(isUserMessageEvent(event)).toBe(true)
  })

  it("should return false for user_message without message property", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
    }

    expect(isUserMessageEvent(event)).toBe(false)
  })

  it("should return false for user_message with non-string message", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: { text: "message" } as any,
    }

    expect(isUserMessageEvent(event)).toBe(false)
  })

  it("should return false for non-user_message types", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      message: "string message",
    }

    expect(isUserMessageEvent(event)).toBe(false)
  })

  it("should return false for user event", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      message: "string message",
    }

    expect(isUserMessageEvent(event)).toBe(false)
  })

  it("should return false for error event", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: "An error",
    }

    expect(isUserMessageEvent(event)).toBe(false)
  })

  it("should handle null message", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: null as any,
    }

    expect(isUserMessageEvent(event)).toBe(false)
  })

  it("should handle undefined message", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: undefined as any,
    }

    expect(isUserMessageEvent(event)).toBe(false)
  })

  it("should handle multiline string message", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: "Line 1\nLine 2\nLine 3",
    }

    expect(isUserMessageEvent(event)).toBe(true)
  })
})
