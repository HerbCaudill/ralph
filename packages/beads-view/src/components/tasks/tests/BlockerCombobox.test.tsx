import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { BlockerCombobox } from "../BlockerCombobox"
import type { TaskCardTask } from "../../../types"

describe("BlockerCombobox", () => {
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
  ]

  it("renders the Add blocker button", () => {
    render(
      <BlockerCombobox
        task={defaultTask}
        allTasks={allTasks}
        issuePrefix="task"
        existingBlockerIds={[]}
        onAdd={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /add blocker/i })).toBeInTheDocument()
  })

  describe("hover styles", () => {
    it("Add blocker button has subtle hover background, not repo-accent", () => {
      render(
        <BlockerCombobox
          task={defaultTask}
          allTasks={allTasks}
          issuePrefix="task"
          existingBlockerIds={[]}
          onAdd={vi.fn()}
        />,
      )

      const button = screen.getByRole("button", { name: /add blocker/i })

      // The button should have a subtle hover background (muted) instead of
      // the default ghost hover (repo-accent) which goes black when no custom
      // repo-accent color is set
      expect(button.className).toMatch(/hover:bg-muted/)

      // It should NOT have the default ghost hover that causes the black background issue
      expect(button.className).not.toMatch(/hover:bg-repo-accent/)
    })
  })

  it("disables button when no tasks are available", () => {
    render(
      <BlockerCombobox
        task={defaultTask}
        allTasks={[defaultTask]} // Only the current task, no available blockers
        issuePrefix="task"
        existingBlockerIds={[]}
        onAdd={vi.fn()}
      />,
    )

    const button = screen.getByRole("button", { name: /add blocker/i })
    expect(button).toBeDisabled()
  })

  it("disables button when disabled prop is true", () => {
    render(
      <BlockerCombobox
        task={defaultTask}
        allTasks={allTasks}
        issuePrefix="task"
        existingBlockerIds={[]}
        onAdd={vi.fn()}
        disabled={true}
      />,
    )

    const button = screen.getByRole("button", { name: /add blocker/i })
    expect(button).toBeDisabled()
  })
})
