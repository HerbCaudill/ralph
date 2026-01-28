import { describe, it, expect } from "vitest"
import { isSystemEvent } from "./isSystemEvent"

describe("isSystemEvent", () => {
  it("returns true for system event", () => {
    expect(
      isSystemEvent({
        type: "system",
        timestamp: 123,
      }),
    ).toBe(true)
  })

  it("returns true for system event with subtype", () => {
    expect(
      isSystemEvent({
        type: "system",
        timestamp: 123,
        subtype: "init",
      }),
    ).toBe(true)
  })

  it("returns false for non-system event types", () => {
    expect(
      isSystemEvent({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(false)
  })

  it("returns false for assistant event", () => {
    expect(
      isSystemEvent({
        type: "assistant",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })

  it("returns false for error event", () => {
    expect(
      isSystemEvent({
        type: "error",
        timestamp: 123,
        error: "Something went wrong",
      }),
    ).toBe(false)
  })
})
