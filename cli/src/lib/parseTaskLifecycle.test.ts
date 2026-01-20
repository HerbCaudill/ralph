import { describe, it, expect } from "vitest"
import { parseTaskLifecycleEvent } from "./parseTaskLifecycle.js"

describe("parseTaskLifecycleEvent", () => {
  describe("starting events", () => {
    it("parses starting event with colon separator", () => {
      const text = "✨ Starting **r-abc1: Add new feature**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-abc1",
        taskTitle: "Add new feature",
      })
    })

    it("parses starting event with space separator", () => {
      const text = "✨ Starting **r-xyz9 Fix the bug**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-xyz9",
        taskTitle: "Fix the bug",
      })
    })

    it("parses starting event without title", () => {
      const text = "✨ Starting **r-def3**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-def3",
        taskTitle: undefined,
      })
    })

    it("parses starting event with sub-task ID", () => {
      const text = "✨ Starting **r-abc1.2: Sub-task title**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-abc1.2",
        taskTitle: "Sub-task title",
      })
    })

    it("parses starting event with whitespace", () => {
      const text = "  ✨ Starting **r-abc1: Title**  "
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-abc1",
        taskTitle: "Title",
      })
    })

    it("parses starting event with complex task ID", () => {
      const text = "✨ Starting **rui-4rt.5.a2: Nested task**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "rui-4rt.5.a2",
        taskTitle: "Nested task",
      })
    })
  })

  describe("completed events", () => {
    it("parses completed event with colon separator", () => {
      const text = "✅ Completed **r-abc1: Add new feature**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: "r-abc1",
        taskTitle: "Add new feature",
      })
    })

    it("parses completed event with space separator", () => {
      const text = "✅ Completed **r-xyz9 Fix the bug**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: "r-xyz9",
        taskTitle: "Fix the bug",
      })
    })

    it("parses completed event without title", () => {
      const text = "✅ Completed **r-def3**"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: "r-def3",
        taskTitle: undefined,
      })
    })
  })

  describe("arrow format (without task ID)", () => {
    it("parses starting event with arrow format", () => {
      const text = "✨ Starting -> Support pausing via stdin"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: undefined,
        taskTitle: "Support pausing via stdin",
      })
    })

    it("parses completed event with arrow format", () => {
      const text = "✅ Completed -> Support pausing via stdin"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "completed",
        taskId: undefined,
        taskTitle: "Support pausing via stdin",
      })
    })

    it("parses starting event with arrow and extra whitespace", () => {
      const text = "  ✨ Starting  ->  Task title  "
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: undefined,
        taskTitle: "Task title",
      })
    })
  })

  describe("multi-line text support", () => {
    it("parses first line when text has multiple lines", () => {
      const text = "✨ Starting **r-abc1: Title**\n\nSome other content"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: "r-abc1",
        taskTitle: "Title",
      })
    })

    it("parses arrow format with multi-line text", () => {
      const text = "✨ Starting -> Task title\n\nAdditional details here"
      const result = parseTaskLifecycleEvent(text)

      expect(result).toEqual({
        action: "starting",
        taskId: undefined,
        taskTitle: "Task title",
      })
    })
  })

  describe("non-matching text", () => {
    it("returns null for regular text", () => {
      const result = parseTaskLifecycleEvent("Hello world")
      expect(result).toBeNull()
    })

    it("returns null for partial matches", () => {
      expect(parseTaskLifecycleEvent("✨ Starting task-123")).toBeNull()
      expect(parseTaskLifecycleEvent("Starting **r-abc1**")).toBeNull()
      expect(parseTaskLifecycleEvent("✅ Completed task-123")).toBeNull()
    })

    it("returns null for text with content before emoji", () => {
      const text = "I am ✨ Starting **r-abc1: Title**"
      expect(parseTaskLifecycleEvent(text)).toBeNull()
    })

    it("returns null for text with content after bold", () => {
      const text = "✨ Starting **r-abc1: Title** now"
      expect(parseTaskLifecycleEvent(text)).toBeNull()
    })
  })
})
