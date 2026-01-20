import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskLifecycleEvent, parseTaskLifecycleEvent } from "./TaskLifecycleEvent"
import { TaskDialogProvider } from "@/contexts"
import { useAppStore } from "@/store"

// Helper to render with context
function renderWithContext(ui: React.ReactNode, openTaskById = vi.fn()) {
  return render(<TaskDialogProvider openTaskById={openTaskById}>{ui}</TaskDialogProvider>)
}

describe("parseTaskLifecycleEvent", () => {
  describe("starting events", () => {
    it("parses starting event with colon separator", () => {
      const text = "✨ Starting **r-abc1: Add new feature**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1",
        taskTitle: "Add new feature",
      })
    })

    it("parses starting event with space separator", () => {
      const text = "✨ Starting **r-xyz9 Fix the bug**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-xyz9",
        taskTitle: "Fix the bug",
      })
    })

    it("parses starting event without title", () => {
      const text = "✨ Starting **r-def3**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-def3",
        taskTitle: undefined,
      })
    })

    it("parses starting event with sub-task ID", () => {
      const text = "✨ Starting **r-abc1.2: Sub-task title**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1.2",
        taskTitle: "Sub-task title",
      })
    })

    it("parses starting event with whitespace", () => {
      const text = "  ✨ Starting **r-abc1: Title**  "
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "r-abc1",
        taskTitle: "Title",
      })
    })

    it("parses starting event with complex task ID", () => {
      const text = "✨ Starting **rui-4rt.5.a2: Nested task**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "starting",
        taskId: "rui-4rt.5.a2",
        taskTitle: "Nested task",
      })
    })
  })

  describe("completed events", () => {
    it("parses completed event with colon separator", () => {
      const text = "✅ Completed **r-abc1: Add new feature**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-abc1",
        taskTitle: "Add new feature",
      })
    })

    it("parses completed event with space separator", () => {
      const text = "✅ Completed **r-xyz9 Fix the bug**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-xyz9",
        taskTitle: "Fix the bug",
      })
    })

    it("parses completed event without title", () => {
      const text = "✅ Completed **r-def3**"
      const result = parseTaskLifecycleEvent(text, 1234567890)

      expect(result).toEqual({
        type: "task_lifecycle",
        timestamp: 1234567890,
        action: "completed",
        taskId: "r-def3",
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
      expect(parseTaskLifecycleEvent("✨ Starting task-123", 1234567890)).toBeNull()
      expect(parseTaskLifecycleEvent("Starting **r-abc1**", 1234567890)).toBeNull()
      expect(parseTaskLifecycleEvent("✅ Completed task-123", 1234567890)).toBeNull()
    })

    it("returns null for multi-line text", () => {
      const text = "✨ Starting **r-abc1: Title**\n\nSome other content"
      expect(parseTaskLifecycleEvent(text, 1234567890)).toBeNull()
    })

    it("returns null for text with content before emoji", () => {
      const text = "I am ✨ Starting **r-abc1: Title**"
      expect(parseTaskLifecycleEvent(text, 1234567890)).toBeNull()
    })

    it("returns null for text with content after bold", () => {
      const text = "✨ Starting **r-abc1: Title** now"
      expect(parseTaskLifecycleEvent(text, 1234567890)).toBeNull()
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
    renderWithContext(
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
    // Task ID is displayed with stripped prefix when context is available
    expect(screen.getByRole("button", { name: "View task r-abc1" })).toBeInTheDocument()
    expect(screen.getByText("Add new feature")).toBeInTheDocument()
    expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "starting")
  })

  it("renders completed event", () => {
    renderWithContext(
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
    expect(screen.getByRole("button", { name: "View task r-xyz9" })).toBeInTheDocument()
    expect(screen.getByText("Fix the bug")).toBeInTheDocument()
    expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "completed")
  })

  it("renders event without title", () => {
    renderWithContext(
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
    expect(screen.getByRole("button", { name: "View task r-def3" })).toBeInTheDocument()
  })

  it("renders task ID as a clickable button when context is available", () => {
    const openTaskById = vi.fn()
    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-abc1",
          taskTitle: "Test task",
        }}
      />,
      openTaskById,
    )

    const button = screen.getByRole("button", { name: "View task r-abc1" })
    expect(button).toBeInTheDocument()
  })

  it("applies custom className", () => {
    renderWithContext(
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
