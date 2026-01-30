import { describe, it, expect } from "vitest"
import { isErrorEvent } from "./isErrorEvent"
import type { ChatEvent } from "../types"

describe("isErrorEvent", () => {
  it("should return true for error type with string error", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: "An error occurred",
    }

    expect(isErrorEvent(event)).toBe(true)
  })

  it("should return true for server_error type with string error", () => {
    const event: ChatEvent = {
      type: "server_error",
      timestamp: 123,
      error: "Server error occurred",
    }

    expect(isErrorEvent(event)).toBe(true)
  })

  it("should return false for error type without error property", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
    }

    expect(isErrorEvent(event)).toBe(false)
  })

  it("should return false for error type with non-string error", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: { message: "error" } as any,
    }

    expect(isErrorEvent(event)).toBe(false)
  })

  it("should return false for non-error event types", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 123,
      error: "Has error property but wrong type",
    }

    expect(isErrorEvent(event)).toBe(false)
  })

  it("should return false for user_message event", () => {
    const event: ChatEvent = {
      type: "user_message",
      timestamp: 123,
      message: "text",
    }

    expect(isErrorEvent(event)).toBe(false)
  })

  it("should handle null error", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: null as any,
    }

    expect(isErrorEvent(event)).toBe(false)
  })

  it("should handle undefined error", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: undefined as any,
    }

    expect(isErrorEvent(event)).toBe(false)
  })

  it("should handle empty string error", () => {
    const event: ChatEvent = {
      type: "error",
      timestamp: 123,
      error: "",
    }

    expect(isErrorEvent(event)).toBe(true)
  })
})
