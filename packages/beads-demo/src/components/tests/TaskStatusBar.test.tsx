import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { TaskStatusBar } from ".././TaskStatusBar"
import type { Workspace } from "@herbcaudill/beads-view"

const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  path: "/home/user/project",
  name: "My Project",
  ...overrides,
})

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
})
