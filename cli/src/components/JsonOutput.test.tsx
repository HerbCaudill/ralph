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
    const text = "<start_task>r-abc1</start_task>"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toEqual({
      action: "starting",
      taskId: "r-abc1",
    })
  })

  it("detects task completion events", () => {
    const text = "<end_task>r-abc1</end_task>"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toEqual({
      action: "completed",
      taskId: "r-abc1",
    })
  })

  it("detects task events within surrounding text", () => {
    const text = "Some text before <start_task>r-xyz9</start_task> and after"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toEqual({
      action: "starting",
      taskId: "r-xyz9",
    })
  })

  it("returns null for non-task-lifecycle text", () => {
    const text = "This is just regular assistant output"
    const result = parseTaskLifecycleEvent(text)

    expect(result).toBeNull()
  })

  it("returns null for old emoji format", () => {
    // Old emoji format is no longer supported
    expect(parseTaskLifecycleEvent("✨ Starting **r-abc1**")).toBeNull()
    expect(parseTaskLifecycleEvent("✅ Completed **r-abc1**")).toBeNull()
  })
})
