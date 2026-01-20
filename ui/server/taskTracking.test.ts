import { describe, it, expect, beforeEach } from "vitest"
import type { RalphEvent } from "./RalphManager.js"

// Import the functions we need to test
// Note: These are exported for testing purposes
import { getCurrentTask, clearEventHistory, getEventHistory } from "./index.js"

describe("Task Tracking", () => {
  beforeEach(() => {
    // Clear state before each test
    clearEventHistory()
  })

  describe("getCurrentTask", () => {
    it("returns undefined taskId and taskTitle when no task is active", () => {
      const task = getCurrentTask()
      expect(task.taskId).toBeUndefined()
      expect(task.taskTitle).toBeUndefined()
    })
  })

  describe("clearEventHistory", () => {
    it("clears current task tracking", () => {
      clearEventHistory()
      const task = getCurrentTask()
      expect(task.taskId).toBeUndefined()
      expect(task.taskTitle).toBeUndefined()
    })

    it("clears event history", () => {
      clearEventHistory()
      const history = getEventHistory()
      expect(history).toHaveLength(0)
    })
  })

  // Note: Testing updateCurrentTask requires integration testing with RalphManager
  // since it's called from the event listener. These tests would be better suited
  // as integration tests that actually spawn a RalphManager and emit events.
})
