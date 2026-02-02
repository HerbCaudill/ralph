import { describe, it, expect } from "vitest"
import { isToolResultEvent } from ".././isToolResultEvent"
import type { ChatEvent } from "../../types"

describe("isToolResultEvent", () => {
  it("should return true for user event with tool_use_result", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      tool_use_result: true,
      message: { role: "user", content: [] },
    }

    expect(isToolResultEvent(event)).toBe(true)
  })

  it("should return true when tool_use_result is any truthy value", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      tool_use_result: "some value",
    }

    expect(isToolResultEvent(event)).toBe(true)
  })

  it("should return true when tool_use_result is an object", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      tool_use_result: { result: "data" },
    }

    expect(isToolResultEvent(event)).toBe(true)
  })

  it("should return false for user event without tool_use_result", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      message: { role: "user", content: [] },
    }

    expect(isToolResultEvent(event)).toBe(false)
  })

  it("should return false when tool_use_result is undefined", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      tool_use_result: undefined,
    }

    expect(isToolResultEvent(event)).toBe(false)
  })

  it("should return true when tool_use_result is false", () => {
    const event: ChatEvent = {
      type: "user",
      timestamp: 123,
      tool_use_result: false as any,
    }

    // The guard checks typeof !== "undefined", not truthiness
    // false is defined, so this returns true
    expect(isToolResultEvent(event)).toBe(true)
  })

  it("should return false for non-user event types", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      tool_use_result: true,
    }

    expect(isToolResultEvent(event)).toBe(false)
  })

  it("should return false for user_message event", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      tool_use_result: true,
    }

    expect(isToolResultEvent(event)).toBe(false)
  })

  it("should return false for error event", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: "An error",
      tool_use_result: true,
    }

    expect(isToolResultEvent(event)).toBe(false)
  })
})
