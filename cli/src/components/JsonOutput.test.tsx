import { describe, it, expect } from "vitest"
import { parseTaskLifecycleEvent } from "../lib/parseTaskLifecycle.js"

/**
 * Integration tests for JsonOutput task tracking.
 *
 * These tests verify that the parseTaskLifecycleEvent function correctly
 * detects task lifecycle events from assistant messages.
 *
 * Full integration testing of JsonOutput would require:
 * - Mocking the Claude SDK's query function
 * - Mocking file system operations
 * - Testing React component rendering with ink-testing-library
 *
 * For now, we test the task detection logic in isolation.
 */

describe("JsonOutput task tracking", () => {
  it("detects task start events", () => {
    const text = "✨ Starting **r-123: Implement new feature**"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toEqual({
      action: "starting",
      taskId: "r-123",
      taskTitle: "Implement new feature",
    })
  })

  it("detects task completion events", () => {
    const text = "✅ Completed **r-123: Implement new feature**"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toEqual({
      action: "completed",
      taskId: "r-123",
      taskTitle: "Implement new feature",
    })
  })

  it("handles task IDs without titles", () => {
    const text = "✨ Starting **r-123**"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toEqual({
      action: "starting",
      taskId: "r-123",
    })
  })

  it("returns null for non-task-lifecycle text", () => {
    const text = "This is just regular assistant output"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toBeNull()
  })
})
