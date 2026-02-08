import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { TaskStatusBar } from ".././TaskStatusBar"
import type { Workspace, Task } from "@herbcaudill/beads-view"

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  path: "/home/user/project",
  name: "My Project",
  ...overrides,
})

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    title: "Test task",
    status: "open",
    ...overrides,
  }
}

describe("TaskStatusBar", () => {
  describe("connection status", () => {
    it("shows 'Connected' when not loading and no error", () => {
      render(<TaskStatusBar workspace={makeWorkspace()} isLoading={false} error={null} />)
      expect(screen.getByText("Connected")).toBeInTheDocument()
    })

    it("shows 'Loading...' when loading", () => {
      render(<TaskStatusBar workspace={makeWorkspace()} isLoading={true} error={null} />)
      expect(screen.getByText("Loading\u2026")).toBeInTheDocument()
    })

    it("shows the error message when there is an error", () => {
      render(
        <TaskStatusBar workspace={makeWorkspace()} isLoading={false} error="Connection refused" />,
      )
      expect(screen.getByText("Connection refused")).toBeInTheDocument()
    })

    it("shows error styling with red text", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          isLoading={false}
          error="Something went wrong"
        />,
      )
      const errorText = screen.getByText("Something went wrong")
      expect(errorText).toHaveClass("text-red-500")
    })

    it("shows spinner when loading", () => {
      const { container } = render(
        <TaskStatusBar workspace={makeWorkspace()} isLoading={true} error={null} />,
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
          isLoading={false}
          error={null}
        />,
      )
      expect(screen.getByText("/home/user/my-app")).toBeInTheDocument()
    })

    it("does not display path when workspace is null", () => {
      render(<TaskStatusBar workspace={null} isLoading={false} error={null} />)
      expect(screen.queryByText("/")).not.toBeInTheDocument()
    })
  })

  describe("progress bar", () => {
    it("displays progress bar when isRunning and has tasks", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          isLoading={false}
          error={null}
          isRunning={true}
          tasks={[createTask({ status: "closed" }), createTask({ status: "open" })]}
          initialTaskCount={2}
        />,
      )
      expect(screen.getByTestId("task-progress-bar")).toBeInTheDocument()
    })

    it("shows correct progress count", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          isLoading={false}
          error={null}
          isRunning={true}
          tasks={[
            createTask({ status: "closed" }),
            createTask({ status: "open" }),
            createTask({ status: "closed" }),
          ]}
          initialTaskCount={3}
          closedTimeFilter="all_time"
        />,
      )
      expect(screen.getByText("2/3")).toBeInTheDocument()
    })

    it("does not display progress bar when isRunning is false", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          isLoading={false}
          error={null}
          isRunning={false}
          tasks={[createTask({ status: "open" })]}
          initialTaskCount={1}
        />,
      )
      expect(screen.queryByTestId("task-progress-bar")).not.toBeInTheDocument()
    })

    it("does not display progress bar when initialTaskCount is null", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          isLoading={false}
          error={null}
          isRunning={true}
          tasks={[createTask({ status: "open" })]}
          initialTaskCount={null}
        />,
      )
      expect(screen.queryByTestId("task-progress-bar")).not.toBeInTheDocument()
    })

    it("does not display progress bar when tasks are not provided", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          isLoading={false}
          error={null}
          isRunning={true}
          initialTaskCount={1}
        />,
      )
      expect(screen.queryByTestId("task-progress-bar")).not.toBeInTheDocument()
    })

    it("uses accent color from props", () => {
      render(
        <TaskStatusBar
          workspace={makeWorkspace()}
          isLoading={false}
          error={null}
          isRunning={true}
          tasks={[createTask({ status: "closed" })]}
          initialTaskCount={1}
          accentColor="#ff0000"
          closedTimeFilter="all_time"
        />,
      )
      const progressBar = screen.getByTestId("task-progress-bar")
      const fillElement = progressBar.querySelector(".h-full")
      expect(fillElement).toHaveStyle({ backgroundColor: "#ff0000" })
    })
  })
})
