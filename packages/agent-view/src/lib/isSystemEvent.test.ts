import { describe, it, expect } from "vitest"
import { isSystemEvent } from "./isSystemEvent"
import type { ChatEvent } from "../types"

describe("isSystemEvent", () => {
  it("should return true for system type", () => {
    const event: ChatEvent = {
      type: "system",
      timestamp: 123,
    }

    expect(isSystemEvent(event)).toBe(true)
  })

  it("should return false for non-system types", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      message: { content: [] },
    }

    expect(isSystemEvent(event)).toBe(false)
  })

  it("should return false for user event", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
    }

    expect(isSystemEvent(event)).toBe(false)
  })

  it("should return false for error event", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: "An error",
    }

    expect(isSystemEvent(event)).toBe(false)
  })

  it("should return false for stream_event", () => {
    const event: ChatEvent = {
      type: "stream_event",
      timestamp: 123,
    }

    expect(isSystemEvent(event)).toBe(false)
  })

  it("should handle system event with additional properties", () => {
    const event: ChatEvent = {
      type: "system",
      timestamp: 123,
      message: "System message",
      metadata: { key: "value" },
    }

    expect(isSystemEvent(event)).toBe(true)
  })
})
