import { describe, it, expect } from "vitest"
import { isRalphTaskStartedEvent } from "./isRalphTaskStartedEvent"

describe("isRalphTaskStartedEvent", () => {
  it("returns true for ralph_task_started event", () => {
    expect(
      isRalphTaskStartedEvent({
        type: "ralph_task_started",
        timestamp: 123,
      }),
    ).toBe(true)
  })

  it("returns true for ralph_task_started event with taskId", () => {
    expect(
      isRalphTaskStartedEvent({
        type: "ralph_task_started",
        timestamp: 123,
        taskId: "task-1",
      }),
    ).toBe(true)
  })

  it("returns false for ralph_task_completed event", () => {
    expect(
      isRalphTaskStartedEvent({
        type: "ralph_task_completed",
        timestamp: 123,
      }),
    ).toBe(false)
  })

  it("returns false for non-ralph event types", () => {
    expect(
      isRalphTaskStartedEvent({
        type: "assistant",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })

  it("returns false for user_message event", () => {
    expect(
      isRalphTaskStartedEvent({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(false)
  })
})
