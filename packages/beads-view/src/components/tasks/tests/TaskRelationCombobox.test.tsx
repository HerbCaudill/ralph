import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { TaskRelationCombobox } from "../TaskRelationCombobox"
import type { TaskCardTask } from "../../../types"

describe("TaskRelationCombobox", () => {
  const defaultTask: TaskCardTask = {
    id: "task-1",
    title: "Test Task",
    status: "open",
    type: "task",
    priority: 2,
  }

  const allTasks: TaskCardTask[] = [
    defaultTask,
    { id: "task-2", title: "Available Task", status: "open", type: "task", priority: 2 },
    { id: "task-3", title: "Another Task", status: "open", type: "task", priority: 2 },
    { id: "task-4", title: "Child Task", status: "open", type: "task", priority: 2, parent: "task-1" },
  ]

  describe("relation type labels", () => {
    it("shows 'Add blocker' for blocker relation type", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="blocker"
          onSelect={vi.fn()}
        />,
      )
      expect(screen.getByRole("button", { name: /add blocker/i })).toBeInTheDocument()
    })

    it("shows 'Add blocked task' for blocked relation type", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="blocked"
          onSelect={vi.fn()}
        />,
      )
      expect(screen.getByRole("button", { name: /add blocked task/i })).toBeInTheDocument()
    })

    it("shows 'Add child' for child relation type", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="child"
          onSelect={vi.fn()}
        />,
      )
      expect(screen.getByRole("button", { name: /add child/i })).toBeInTheDocument()
    })

    it("shows 'Set parent' for parent relation type", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="parent"
          onSelect={vi.fn()}
        />,
      )
      expect(screen.getByRole("button", { name: /set parent/i })).toBeInTheDocument()
    })

    it("uses custom button text when provided", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="blocker"
          buttonText="Custom Text"
          onSelect={vi.fn()}
        />,
      )
      expect(screen.getByRole("button", { name: /custom text/i })).toBeInTheDocument()
    })
  })

  describe("filtering", () => {
    it("excludes the current task from available options", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={[defaultTask, { id: "task-2", title: "Other", status: "open", type: "task", priority: 2 }]}
          issuePrefix="task"
          relationType="blocker"
          onSelect={vi.fn()}
        />,
      )
      // Button should be enabled because there's one other task
      expect(screen.getByRole("button", { name: /add blocker/i })).not.toBeDisabled()
    })

    it("excludes tasks in excludeIds", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          excludeIds={["task-2", "task-3"]}
          relationType="blocker"
          onSelect={vi.fn()}
        />,
      )
      // task-4 is still available (it's a child but that doesn't matter for blocker relation)
      expect(screen.getByRole("button", { name: /add blocker/i })).not.toBeDisabled()
    })

    it("disables button when no tasks are available", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={[defaultTask]} // Only the current task
          issuePrefix="task"
          relationType="blocker"
          onSelect={vi.fn()}
        />,
      )
      expect(screen.getByRole("button", { name: /add blocker/i })).toBeDisabled()
    })
  })

  describe("disabled state", () => {
    it("disables button when disabled prop is true", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="blocker"
          onSelect={vi.fn()}
          disabled={true}
        />,
      )
      expect(screen.getByRole("button", { name: /add blocker/i })).toBeDisabled()
    })
  })

  describe("hover styles", () => {
    it("button has subtle hover background, not repo-accent", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="blocker"
          onSelect={vi.fn()}
        />,
      )

      const button = screen.getByRole("button", { name: /add blocker/i })
      expect(button.className).toMatch(/hover:bg-muted/)
      expect(button.className).not.toMatch(/hover:bg-repo-accent/)
    })
  })
})
