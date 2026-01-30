import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { parseTaskLifecycleEvent } from "@herbcaudill/agent-view"
import { TaskLifecycleEvent } from "./TaskLifecycleEvent"
import { AgentViewTestWrapper } from "@/test/agentViewTestWrapper"
import type { AgentViewContextValue, AgentViewTask } from "@herbcaudill/agent-view"

/** Render TaskLifecycleEvent wrapped in AgentViewProvider. */
function renderWithContext(ui: React.ReactElement, overrides?: Partial<AgentViewContextValue>) {
  return render(
    <AgentViewTestWrapper
      value={{
        linkHandlers: {
          taskIdPrefix: "r",
          buildTaskHref: (id: string) => `/issue/${id}`,
          buildSessionHref: (id: string) => `/session/${id}`,
        },
        ...overrides,
      }}
    >
      {ui}
    </AgentViewTestWrapper>,
  )
}

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
  it("renders starting event", () => {
    const tasks: AgentViewTask[] = [{ id: "r-abc1", title: "Add new feature" }]

    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-abc1",
        }}
      />,
      { tasks },
    )

    expect(screen.getByText("Starting")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "View task r-abc1" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/issue/r-abc1")
    expect(screen.getByText("Add new feature")).toBeInTheDocument()
    expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "starting")
  })

  it("renders completed event", () => {
    const tasks: AgentViewTask[] = [{ id: "r-xyz9", title: "Fix the bug" }]

    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "completed",
          taskId: "r-xyz9",
        }}
      />,
      { tasks },
    )

    expect(screen.getByText("Completed")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "View task r-xyz9" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/issue/r-xyz9")
    expect(screen.getByText("Fix the bug")).toBeInTheDocument()
    expect(screen.getByTestId("task-lifecycle-event")).toHaveAttribute("data-action", "completed")
  })

  it("renders event without title when task not in store", () => {
    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-def3",
        }}
      />,
      { tasks: [] },
    )

    expect(screen.getByText("Starting")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-def3" })).toBeInTheDocument()
  })

  it("looks up task title from store", () => {
    const tasks: AgentViewTask[] = [{ id: "r-store1", title: "Task from store" }]

    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-store1",
        }}
      />,
      { tasks },
    )

    expect(screen.getByText("Starting")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-store1" })).toBeInTheDocument()
    expect(screen.getByText("Task from store")).toBeInTheDocument()
  })

  it("uses store title for task", () => {
    const tasks: AgentViewTask[] = [{ id: "r-pref1", title: "Store title" }]

    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-pref1",
        }}
      />,
      { tasks },
    )

    expect(screen.getByText("Store title")).toBeInTheDocument()
  })

  it("looks up task title from store for completed events", () => {
    const tasks: AgentViewTask[] = [{ id: "r-comp1", title: "Completed task from store" }]

    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "completed",
          taskId: "r-comp1",
        }}
      />,
      { tasks },
    )

    expect(screen.getByText("Completed")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-comp1" })).toBeInTheDocument()
    expect(screen.getByText("Completed task from store")).toBeInTheDocument()
  })

  it("handles store with multiple tasks, returning correct title", () => {
    const tasks: AgentViewTask[] = [
      { id: "r-other1", title: "Other task 1" },
      { id: "r-target", title: "Target task title" },
      { id: "r-other2", title: "Other task 2" },
    ]

    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-target",
        }}
      />,
      { tasks },
    )

    expect(screen.getByText("Target task title")).toBeInTheDocument()
    expect(screen.queryByText("Other task 1")).not.toBeInTheDocument()
    expect(screen.queryByText("Other task 2")).not.toBeInTheDocument()
  })

  it("handles taskId not found in store with other tasks present", () => {
    const tasks: AgentViewTask[] = [
      { id: "r-other1", title: "Other task 1" },
      { id: "r-other2", title: "Other task 2" },
    ]

    renderWithContext(
      <TaskLifecycleEvent
        event={{
          type: "task_lifecycle",
          timestamp: 1234567890,
          action: "starting",
          taskId: "r-notfound",
        }}
      />,
      { tasks },
    )

    expect(screen.getByText("Starting")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View task r-notfound" })).toBeInTheDocument()
    expect(screen.queryByText("Other task 1")).not.toBeInTheDocument()
    expect(screen.queryByText("Other task 2")).not.toBeInTheDocument()
  })

  it("renders task ID as a clickable link", () => {
    renderWithContext(
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
