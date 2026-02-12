import { describe, it, expect } from "vitest"
import { parseTaskLifecycleEvent } from ".././parseTaskLifecycle.js"

describe("parseTaskLifecycleEvent", () => {
  describe("starting events", () => {
    it("parses start_task XML tag", () => {
      const text = "<start_task>r-abc1</start_task>"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-abc1",
      })
    })

    it("parses start_task with sub-task ID", () => {
      const text = "<start_task>r-abc1.2</start_task>"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-abc1.2",
      })
    })

    it("parses start_task with complex task ID", () => {
      const text = "<start_task>rui-4rt.5.a2</start_task>"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "rui-4rt.5.a2",
      })
    })

    it("parses start_task within surrounding text", () => {
      const text = "Some text before <start_task>r-xyz9</start_task> and after"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-xyz9",
      })
    })

    it("parses start_task with whitespace in surrounding text", () => {
      const text = "  <start_task>r-abc1</start_task>  "
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-abc1",
      })
    })
  })

  describe("completed events", () => {
    it("parses end_task XML tag", () => {
      const text = "<end_task>r-abc1</end_task>"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: "r-abc1",
      })
    })

    it("parses end_task with sub-task ID", () => {
      const text = "<end_task>r-abc1.2</end_task>"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: "r-abc1.2",
      })
    })

    it("parses end_task within surrounding text", () => {
      const text = "Task completed: <end_task>r-xyz9</end_task>"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: "r-xyz9",
      })
    })
  })

  describe("multi-line text support", () => {
    it("parses start_task in multi-line text", () => {
      const text = "Some text\n<start_task>r-def3</start_task>\nMore content"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-def3",
      })
    })

    it("parses end_task in multi-line text", () => {
      const text = "First line\n<end_task>r-abc1</end_task>\nLast line"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: "r-abc1",
      })
    })
  })

  describe("non-matching text", () => {
    it("returns null for regular text", () => {
      const result = parseTaskLifecycleEvent("Hello world")
      expect(result).toBeNull()
    })

    it("returns null for partial matches", () => {
      expect(parseTaskLifecycleEvent("<start_task>task-123")).toBeNull()
      expect(parseTaskLifecycleEvent("r-abc1</start_task>")).toBeNull()
      expect(parseTaskLifecycleEvent("<end_task>")).toBeNull()
    })

    it("returns null for invalid task ID format", () => {
      // Task IDs must start with letters, not numbers
      expect(parseTaskLifecycleEvent("<start_task>123</start_task>")).toBeNull()
      // Task IDs must have at least one hyphen
      expect(parseTaskLifecycleEvent("<start_task>invalidid</start_task>")).toBeNull()
    })

    it("returns null for old emoji format", () => {
      expect(parseTaskLifecycleEvent("✨ Starting **r-abc1**")).toBeNull()
      expect(parseTaskLifecycleEvent("✅ Completed **r-abc1**")).toBeNull()
    })
  })
})
