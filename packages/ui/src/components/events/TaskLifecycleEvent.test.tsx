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

    it("does not parse emoji starting format (no longer supported)", () => {
      const result = parseTaskLifecycleEvent("✨ Starting **r-abc1**", 1234567890)
      expect(result).toBeNull()
    })

    it("parses emoji completed format", () => {
      const result = parseTaskLifecycleEvent("✅ Completed **r-abc1**", 1234567890)
      expect(result).toBeNull()
    })

    it("does not parse emoji format with task title (no longer supported)", () => {
      const result = parseTaskLifecycleEvent("✨ Starting **r-abc1 Fix the bug**", 1234567890)
      expect(result).toBeNull()
    })

    it("does not parse emoji completed format with task title (no longer supported)", () => {
      const result = parseTaskLifecycleEvent("✅ Completed **r-xyz9 Add new feature**", 1234567890)
      expect(result).toBeNull()
    })

    it("does not parse emoji format with sub-task ID (no longer supported)", () => {
      const result = parseTaskLifecycleEvent("✨ Starting **r-abc1.2**", 1234567890)
      expect(result).toBeNull()
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
    // Add task to store for title lookup
    useAppStore.getState().setTasks([
      {
        id: "r-abc1",
        title: "Add new feature",
        status: "in_progress",
      },
    ])

    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-abc1",
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
    // Add task to store for title lookup
    useAppStore.getState().setTasks([
      {
        id: "r-xyz9",
        title: "Fix the bug",
        status: "closed",
      },
    ])

    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "completed",
          taskId: "r-xyz9",
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

  it("renders event without title when task not in store", () => {
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

  it("looks up task title from store", () => {
    // Add task to store
    useAppStore.getState().setTasks([
      {
        id: "r-store1",
        title: "Task from store",
        status: "in_progress",
      },
    ])

    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-store1",
        }}
      />,
    )

    expect(screen.getByText("Starting")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-store1" })).toBeInTheDocument()
    // Title should be looked up from store
    expect(screen.getByText("Task from store")).toBeInTheDocument()
  })

  it("uses store title for task", () => {
    // Add task to store
    useAppStore.getState().setTasks([
      {
        id: "r-pref1",
        title: "Store title",
        status: "in_progress",
      },
    ])

    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-pref1",
        }}
      />,
    )

    // Store title should be used
    expect(screen.getByText("Store title")).toBeInTheDocument()
  })

  it("looks up task title from store for completed events", () => {
    // Add task to store
    useAppStore.getState().setTasks([
      {
        id: "r-comp1",
        title: "Completed task from store",
        status: "closed",
      },
    ])

    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "completed",
          taskId: "r-comp1",
        }}
      />,
    )

    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-comp1" })).toBeInTheDocument()
    // Title should be looked up from store
    expect(screen.getByText("Completed task from store")).toBeInTheDocument()
  })

  it("handles store with multiple tasks, returning correct title", () => {
    // Add multiple tasks to store
    useAppStore.getState().setTasks([
      {
        id: "r-other1",
        title: "Other task 1",
        status: "open",
      },
      {
        id: "r-target",
        title: "Target task title",
        status: "in_progress",
      },
      {
        id: "r-other2",
        title: "Other task 2",
        status: "closed",
      },
    ])

    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-target",
        }}
      />,
    )

    // Should find the correct task among multiple tasks
    expect(screen.getByText("Target task title")).toBeInTheDocument()
    expect(screen.queryByText("Other task 1")).not.toBeInTheDocument()
    expect(screen.queryByText("Other task 2")).not.toBeInTheDocument()
  })

  it("handles taskId not found in store with other tasks present", () => {
    // Add tasks to store, but not the one we're looking for
    useAppStore.getState().setTasks([
      {
        id: "r-other1",
        title: "Other task 1",
        status: "open",
      },
      {
        id: "r-other2",
        title: "Other task 2",
        status: "in_progress",
      },
    ])

    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-notfound",
          // No taskTitle provided
        }}
      />,
    )

    // Should render without title since task not in store
    expect(screen.getByText("Starting")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-notfound" })).toBeInTheDocument()
    expect(screen.queryByText("Other task 1")).not.toBeInTheDocument()
    expect(screen.queryByText("Other task 2")).not.toBeInTheDocument()
  })

  it("renders task ID as a clickable link", () => {
    render(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-abc1",
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
