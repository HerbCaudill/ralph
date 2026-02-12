import { describe, it, expect } from "vitest"
import { parseTaskLifecycleEvent } from "../parseTaskLifecycleEvent"

describe("parseTaskLifecycleEvent", () => {
  const timestamp = 1234567890

  describe("start_task events", () => {
    it("should parse start_task tag", () => {
      const text = "<start_task>r-abc123</start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "starting",
        taskId: "r-abc123",
      })
    })

    it("should parse task ID with subtask", () => {
      const text = "<start_task>r-abc123.5</start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "starting",
        taskId: "r-abc123.5",
      })
    })

    it("should handle different prefixes", () => {
      const text = "<start_task>rui-4vp</start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "starting",
        taskId: "rui-4vp",
      })
    })

    it("should be case insensitive", () => {
      const text = "<START_TASK>r-abc123</START_TASK>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "starting",
        taskId: "r-abc123",
      })
    })

    it("should extract from text with surrounding content", () => {
      const text = "Starting work on task <start_task>r-abc123</start_task> now."
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "starting",
        taskId: "r-abc123",
      })
    })
  })

  describe("end_task events", () => {
    it("should parse end_task tag", () => {
      const text = "<end_task>r-abc123</end_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "completed",
        taskId: "r-abc123",
      })
    })

    it("should parse task ID with subtask", () => {
      const text = "<end_task>r-abc123.5</end_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "completed",
        taskId: "r-abc123.5",
      })
    })

    it("should handle different prefixes", () => {
      const text = "<end_task>rui-4vp</end_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "completed",
        taskId: "rui-4vp",
      })
    })

    it("should be case insensitive", () => {
      const text = "<END_TASK>r-abc123</END_TASK>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "completed",
        taskId: "r-abc123",
      })
    })

    it("should extract from text with surrounding content", () => {
      const text = "Task completed: <end_task>r-abc123</end_task>. Moving on."
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "completed",
        taskId: "r-abc123",
      })
    })
  })

  describe("invalid patterns", () => {
    it("should return null for plain text", () => {
      const text = "This is just plain text"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for malformed tag", () => {
      const text = "<start_task>r-abc123"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for invalid task ID format", () => {
      const text = "<start_task>invalid</start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for empty task ID", () => {
      const text = "<start_task></start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toBeNull()
    })

    it("should return null for task ID without hyphen", () => {
      const text = "<start_task>rabc123</start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toBeNull()
    })
  })

  describe("complex task IDs", () => {
    it("should handle multiple subtask levels", () => {
      const text = "<start_task>r-abc123.5.3</start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "starting",
        taskId: "r-abc123.5.3",
      })
    })

    it("should handle alphanumeric task IDs", () => {
      const text = "<start_task>rui-4vp9a2</start_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp,
        action: "starting",
        taskId: "rui-4vp9a2",
      })
    })
  })

  describe("edge cases", () => {
    it("should return null for empty string", () => {
      const result = parseTaskLifecycleEvent("", timestamp)

      expect(result).toBeNull()
    })

    it("should prefer first match when multiple tags present", () => {
      const text = "<start_task>r-abc</start_task> and <end_task>r-xyz</end_task>"
      const result = parseTaskLifecycleEvent(text, timestamp)

      expect(result?.action).toBe("starting")
      expect(result?.taskId).toBe("r-abc")
    })
  })
})
