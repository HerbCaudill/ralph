import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"
import { parseTaskLifecycleEvent } from "@/lib/parseTaskLifecycleEvent"
import { useAppStore } from "@/store"

describe("parseTaskLifecycleEvent", () => {
  describe("starting events", () => {
    it("parses start_task XML tag", () => {
      const text = "<start_task>r-abc1</start_task>"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1",
        taskTitle: undefined,
      })
    })

    it("parses start_task with sub-task ID", () => {
      const text = "<start_task>r-abc1.2</start_task>"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1.2",
        taskTitle: undefined,
      })
    })

    it("parses start_task with complex task ID", () => {
      const text = "<start_task>rui-4rt.5.a2</start_task>"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "rui-4rt.5.a2",
        taskTitle: undefined,
      })
    })

    it("parses start_task within surrounding text", () => {
      const text = "Some text before <start_task>r-xyz9</start_task> and after"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-xyz9",
        taskTitle: undefined,
      })
    })

    it("parses start_task with whitespace in surrounding text", () => {
      const text = "  <start_task>r-abc1</start_task>  "
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1",
        taskTitle: undefined,
      })
    })

    it("parses start_task in multi-line text", () => {
      const text = "Some text\n<start_task>r-def3</start_task>\nMore content"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-def3",
        taskTitle: undefined,
      })
    })
  })

  describe("completed events", () => {
    it("parses end_task XML tag", () => {
      const text = "<end_task>r-abc1</end_task>"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-abc1",
        taskTitle: undefined,
      })
    })

    it("parses end_task with sub-task ID", () => {
      const text = "<end_task>r-abc1.2</end_task>"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-abc1.2",
        taskTitle: undefined,
      })
    })

    it("parses end_task within surrounding text", () => {
      const text = "Task completed: <end_task>r-xyz9</end_task>"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-xyz9",
        taskTitle: undefined,
      })
    })
  })

  describe("non-matching text", () => {
    it("returns null for regular text", () => {
      const result = parseTaskLifecycleEvent("Hello world", 1234567890)
      expect(result).toBeNull()
    })

    it("returns null for partial matches", () => {
      expect(parseTaskLifecycleEvent("<start_task>task-123", 1234567890)).toBeNull()
      expect(parseTaskLifecycleEvent("r-abc1</start_task>", 1234567890)).toBeNull()
      expect(parseTaskLifecycleEvent("<end_task>", 1234567890)).toBeNull()
    })

    it("returns null for invalid task ID format", () => {
      // Task IDs must start with letters, not numbers
      expect(parseTaskLifecycleEvent("<start_task>123</start_task>", 1234567890)).toBeNull()
      // Task IDs must have at least one hyphen
      expect(parseTaskLifecycleEvent("<start_task>invalidid</start_task>", 1234567890)).toBeNull()
    })

    it("parses emoji starting format", () => {
      const result = parseTaskLifecycleEvent("✨ Starting **r-abc1**", 1234567890)
      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1",
        taskTitle: undefined,
      })
    })

    it("parses emoji completed format", () => {
      const result = parseTaskLifecycleEvent("✅ Completed **r-abc1**", 1234567890)
      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-abc1",
        taskTitle: undefined,
      })
    })

    it("parses emoji format with task title", () => {
      const result = parseTaskLifecycleEvent("✨ Starting **r-abc1 Fix the bug**", 1234567890)
      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1",
        taskTitle: "Fix the bug",
      })
    })

    it("parses emoji completed format with task title", () => {
      const result = parseTaskLifecycleEvent("✅ Completed **r-xyz9 Add new feature**", 1234567890)
      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-xyz9",
        taskTitle: "Add new feature",
      })
    })

    it("parses emoji format with sub-task ID", () => {
      const result = parseTaskLifecycleEvent("✨ Starting **r-abc1.2**", 1234567890)
      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1.2",
        taskTitle: undefined,
      })
    })
  })
})

describe("TaskLifecycleEvent", () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().reset()
    // Set a default issue prefix for tests
    useAppStore.getState().setIssuePrefix("r")
  })

  it("renders starting event", () => {
    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-abc1",
          taskTitle: "Add new feature",
        }}
      />,
    )

    expect(screen.getByText("Starting")).toBeInTheDocument()
    // Task ID is rendered as a link
    const link = screen.getByRole("link", { name: "View task r-abc1" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/issue/r-abc1")
    expect(screen.getByText("Add new feature")).toBeInTheDocument()
    expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "starting")
  })

  it("renders completed event", () => {
    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "completed",
          taskId: "r-xyz9",
          taskTitle: "Fix the bug",
        }}
      />,
    )

    expect(screen.getByText("Completed")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "View task r-xyz9" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/issue/r-xyz9")
    expect(screen.getByText("Fix the bug")).toBeInTheDocument()
    expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "completed")
  })

  it("renders event without title", () => {
    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-def3",
        }}
      />,
    )

    expect(screen.getByText("Starting")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-def3" })).toBeInTheDocument()
  })

  it("renders task ID as a clickable link", () => {
    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-abc1",
          taskTitle: "Test task",
        }}
      />,
    )

    const link = screen.getByRole("link", { name: "View task r-abc1" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/issue/r-abc1")
  })

  it("applies custom className", () => {
    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-abc1",
        }}
        className="custom-class"
      />,
    )

    expect(screen.getByTestId("task-lifecycle-event")).toHaveClass("custom-class")
  })
})
