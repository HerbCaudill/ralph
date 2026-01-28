import { describe, it, expect } from "vitest"
import { isRalphTaskCompletedEvent } from "./isRalphTaskCompletedEvent"

describe("isRalphTaskCompletedEvent", () => {
  it("returns true for ralph_task_completed event", () => {
    expect(
      isRalphTaskCompletedEvent({
        type: "ralph_task_completed",
        timestamp: 123,
      }),
    ).toBe(true)
  })

  it("returns true for ralph_task_completed event with taskId", () => {
    expect(
      isRalphTaskCompletedEvent({
        type: "ralph_task_completed",
        timestamp: 123,
        taskId: "task-1",
      }),
    ).toBe(true)
  })

  it("returns false for ralph_task_started event", () => {
    expect(
      isRalphTaskCompletedEvent({
        type: "ralph_task_started",
        timestamp: 123,
      }),
    ).toBe(false)
  })

  it("returns false for non-ralph event types", () => {
    expect(
      isRalphTaskCompletedEvent({
        type: "assistant",
        timestamp: 123,
        message: { content: [] },
      }),
    ).toBe(false)
  })

  it("returns false for user_message event", () => {
    expect(
      isRalphTaskCompletedEvent({
        type: "user_message",
        timestamp: 123,
        message: "Hello",
      }),
    ).toBe(false)
  })
})
