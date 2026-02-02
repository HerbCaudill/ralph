import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { TaskStatusBar } from "./TaskStatusBar"
import type { Workspace } from "../hooks/useWorkspace"
import type { TaskCardTask } from "@herbcaudill/beads-view"

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  path: "/home/user/project",
  name: "My Project",
  ...overrides,
})

const makeTask = (overrides: Partial<TaskCardTask> = {}): TaskCardTask => ({
  id: "task-1",
  title: "Sample task",
  status: "open",
  ...overrides,
})

describe("TaskStatusBar", () => {
  describe("connection status", () => {
    it("shows 'Connected' when not loading and no error", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={[]}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    it("shows 'Loading...' when loading", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={[]}
          isLoading={true}
          error={null}
        />
      )
      expect(screen.getByText("Loading\u2026")).toBeInTheDocument()
    })

    it("shows the error message when there is an error", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={[]}
          isLoading={false}
          error="Connection refused"
        />
      )
      expect(screen.getByText("Connection refused")).toBeInTheDocument()
    })

    it("shows error styling with red text", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={[]}
          isLoading={false}
          error="Something went wrong"
        />
      )
      const errorText = screen.getByText("Something went wrong")
      expect(errorText).toHaveClass("text-red-500")
    })

    it("shows spinner when loading", () => {
      const { container } = render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={[]}
          isLoading={true}
          error={null}
        />
      )
      const spinner = container.querySelector(".animate-spin")
      expect(spinner).toBeInTheDocument()
    })
  })

  describe("workspace path", () => {
    it("displays the workspace path", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace({ path: "/home/user/my-app" })}
          tasks={[]}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.getByText("/home/user/my-app")).toBeInTheDocument()
    })

    it("does not display path when workspace is null", () => {
      render(
        <TaskStatusBar
          workspace={null}
          tasks={[]}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.queryByText("/")).not.toBeInTheDocument()
    })
  })

  describe("task counts", () => {
    it("shows open, closed, and total counts", () => {
      const tasks: TaskCardTask[] = [
        makeTask({ id: "1", status: "open" }),
        makeTask({ id: "2", status: "in_progress" }),
        makeTask({ id: "3", status: "closed" }),
        makeTask({ id: "4", status: "closed" }),
        makeTask({ id: "5", status: "open" }),
      ]
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={tasks}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.getByText("3 open")).toBeInTheDocument()
      expect(screen.getByText("2 closed")).toBeInTheDocument()
      expect(screen.getByText("5 total")).toBeInTheDocument()
    })

    it("counts in_progress tasks as open", () => {
      const tasks: TaskCardTask[] = [
        makeTask({ id: "1", status: "in_progress" }),
        makeTask({ id: "2", status: "in_progress" }),
      ]
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={tasks}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.getByText("2 open")).toBeInTheDocument()
      expect(screen.getByText("0 closed")).toBeInTheDocument()
    })

    it("does not show task counts when there are no tasks", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={[]}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.queryByText(/open/)).not.toBeInTheDocument()
      expect(screen.queryByText(/closed/)).not.toBeInTheDocument()
      expect(screen.queryByText(/total/)).not.toBeInTheDocument()
    })

    it("handles all-closed tasks", () => {
      const tasks: TaskCardTask[] = [
        makeTask({ id: "1", status: "closed" }),
        makeTask({ id: "2", status: "closed" }),
      ]
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={tasks}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.getByText("0 open")).toBeInTheDocument()
      expect(screen.getByText("2 closed")).toBeInTheDocument()
      expect(screen.getByText("2 total")).toBeInTheDocument()
    })

    it("handles blocked and deferred statuses as neither open nor closed", () => {
      const tasks: TaskCardTask[] = [
        makeTask({ id: "1", status: "open" }),
        makeTask({ id: "2", status: "blocked" }),
        makeTask({ id: "3", status: "deferred" }),
      ]
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          tasks={tasks}
          isLoading={false}
          error={null}
        />
      )
      expect(screen.getByText("1 open")).toBeInTheDocument()
      expect(screen.getByText("0 closed")).toBeInTheDocument()
      expect(screen.getByText("3 total")).toBeInTheDocument()
    })
  })
})
