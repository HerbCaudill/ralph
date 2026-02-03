import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { RepoBranch } from "../RepoBranch"

describe("RepoBranch", () => {
  describe("rendering", () => {
    it("renders workspace name and branch with separator", () => {
      render(<RepoBranch workspaceName="ralph" branch="main" />)
      const container = screen.getByTestId("repo-branch")
      expect(container).toHaveTextContent("ralph")
      expect(container).toHaveTextContent("/")
      expect(container).toHaveTextContent("main")
    })

    it("renders only workspace name when branch is not provided", () => {
      render(<RepoBranch workspaceName="ralph" />)
      expect(screen.getByText("ralph")).toBeInTheDocument()
      expect(screen.queryByText("/")).not.toBeInTheDocument()
    })

    it("renders only branch when workspace name is not provided", () => {
      render(<RepoBranch branch="main" />)
      expect(screen.getByText("main")).toBeInTheDocument()
      expect(screen.queryByText("/")).not.toBeInTheDocument()
    })

    it("returns null when neither workspace name nor branch is provided", () => {
      const { container } = render(<RepoBranch />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe("icons", () => {
    it("renders git branch icon", () => {
      render(<RepoBranch workspaceName="ralph" branch="main" />)
      // The IconGitBranch from tabler-icons-react renders an SVG with specific classes
      const svg = screen.getByTestId("repo-branch").querySelector("svg")
      expect(svg).toBeInTheDocument()
    })
  })

  describe("truncation", () => {
    it("truncates long workspace names", () => {
      render(<RepoBranch workspaceName="very-long-workspace-name-that-should-be-truncated" />)
      const container = screen.getByTestId("repo-branch")
      expect(container).toHaveClass("truncate")
    })
  })

  describe("custom className", () => {
    it("applies custom className", () => {
      render(<RepoBranch workspaceName="ralph" branch="main" className="custom-class" />)
      const container = screen.getByTestId("repo-branch")
      expect(container).toHaveClass("custom-class")
    })
  })

  describe("accessibility", () => {
    it("has title attribute showing full workspace path when provided", () => {
      render(<RepoBranch workspaceName="ralph" branch="main" workspacePath="/home/user/ralph" />)
      const container = screen.getByTestId("repo-branch")
      expect(container).toHaveAttribute("title", "/home/user/ralph")
    })
  })
})
