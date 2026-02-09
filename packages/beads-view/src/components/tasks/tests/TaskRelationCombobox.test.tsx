import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
    {
      id: "task-4",
      title: "Child Task",
      status: "open",
      type: "task",
      priority: 2,
      parent: "task-1",
    },
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
          allTasks={[
            defaultTask,
            { id: "task-2", title: "Other", status: "open", type: "task", priority: 2 },
          ]}
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

    it("excludes closed tasks for blocker relation type", () => {
      const tasksWithClosed = [
        defaultTask,
        {
          id: "task-2",
          title: "Open Task",
          status: "open" as const,
          type: "task" as const,
          priority: 2,
        },
        {
          id: "task-3",
          title: "Closed Task",
          status: "closed" as const,
          type: "task" as const,
          priority: 2,
        },
      ]
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={tasksWithClosed}
          issuePrefix="task"
          relationType="blocker"
          onSelect={vi.fn()}
        />,
      )
      // Button should be enabled - there's still one open task
      expect(screen.getByRole("button", { name: /add blocker/i })).not.toBeDisabled()
    })

    it("disables button when only closed tasks remain for blocker relation", () => {
      const tasksWithOnlyClosed = [
        defaultTask,
        {
          id: "task-2",
          title: "Closed Task",
          status: "closed" as const,
          type: "task" as const,
          priority: 2,
        },
      ]
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={tasksWithOnlyClosed}
          issuePrefix="task"
          relationType="blocker"
          onSelect={vi.fn()}
        />,
      )
      // Button should be disabled - no open tasks available
      expect(screen.getByRole("button", { name: /add blocker/i })).toBeDisabled()
    })

    it("excludes closed tasks for blocked relation type", () => {
      const tasksWithClosed = [
        defaultTask,
        {
          id: "task-2",
          title: "Open Task",
          status: "open" as const,
          type: "task" as const,
          priority: 2,
        },
        {
          id: "task-3",
          title: "Closed Task",
          status: "closed" as const,
          type: "task" as const,
          priority: 2,
        },
      ]
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={tasksWithClosed}
          issuePrefix="task"
          relationType="blocked"
          onSelect={vi.fn()}
        />,
      )
      // Button should be enabled - there's still one open task
      expect(screen.getByRole("button", { name: /add blocked task/i })).not.toBeDisabled()
    })

    it("excludes closed tasks for parent relation type", () => {
      const tasksWithClosed = [
        defaultTask,
        {
          id: "task-2",
          title: "Open Task",
          status: "open" as const,
          type: "task" as const,
          priority: 2,
        },
        {
          id: "task-3",
          title: "Closed Task",
          status: "closed" as const,
          type: "task" as const,
          priority: 2,
        },
      ]
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={tasksWithClosed}
          issuePrefix="task"
          relationType="parent"
          onSelect={vi.fn()}
        />,
      )
      // Button should be enabled - there's still one open task
      expect(screen.getByRole("button", { name: /set parent/i })).not.toBeDisabled()
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

  describe("parent selection mode", () => {
    it("shows selected parent value when selectedValue is provided", () => {
      const parentTask: TaskCardTask = {
        id: "parent-1",
        title: "Parent Epic",
        status: "open",
        type: "epic",
        priority: 1,
      }
      const childTask: TaskCardTask = {
        id: "child-1",
        title: "Child Task",
        status: "open",
        type: "task",
        priority: 2,
        parent: "parent-1",
      }
      const tasksWithParent = [parentTask, childTask]

      render(
        <TaskRelationCombobox
          task={childTask}
          allTasks={tasksWithParent}
          issuePrefix="task"
          relationType="parent"
          onSelect={vi.fn()}
          selectedValue="parent-1"
        />,
      )

      // Should show the selected parent's ID and title (prefix stripped)
      expect(screen.getByText("parent-1 Parent Epic")).toBeInTheDocument()
      // Should have combobox role for selection display
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })

    it("shows 'None' when selectedValue is empty and showSelectedValue is true", () => {
      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          relationType="parent"
          onSelect={vi.fn()}
          selectedValue={null}
          showSelectedValue
        />,
      )

      expect(screen.getByText("None")).toBeInTheDocument()
    })

    it("shows 'Set parent' button when no selectedValue and showSelectedValue is false", () => {
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

    it("includes 'None' option in dropdown when selectedValue is provided", async () => {
      const parentTask: TaskCardTask = {
        id: "parent-1",
        title: "Parent Epic",
        status: "open",
        type: "epic",
        priority: 1,
      }

      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={[defaultTask, parentTask]}
          issuePrefix="task"
          relationType="parent"
          onSelect={vi.fn()}
          selectedValue="parent-1"
        />,
      )

      // Click to open the dropdown
      const combobox = screen.getByRole("combobox")
      fireEvent.click(combobox)

      // Should include a "None" option to clear the selection
      await waitFor(() => {
        expect(screen.getByText("None")).toBeInTheDocument()
      })
    })

    it("calls onSelect with null when 'None' is selected", async () => {
      const onSelect = vi.fn()

      const parentTask: TaskCardTask = {
        id: "parent-1",
        title: "Parent Epic",
        status: "open",
        type: "epic",
        priority: 1,
      }

      render(
        <TaskRelationCombobox
          task={defaultTask}
          allTasks={[defaultTask, parentTask]}
          issuePrefix="task"
          relationType="parent"
          onSelect={onSelect}
          selectedValue="parent-1"
        />,
      )

      // Click to open the dropdown
      const combobox = screen.getByRole("combobox")
      fireEvent.click(combobox)

      // Wait for dropdown to open, then click the "None" option
      await waitFor(() => {
        expect(screen.getByText("None")).toBeInTheDocument()
      })

      const noneOption = screen.getByText("None").closest("[cmdk-item]")
      expect(noneOption).toBeInTheDocument()
      fireEvent.click(noneOption!)

      expect(onSelect).toHaveBeenCalledWith(null)
    })
  })
})
