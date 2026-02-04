import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusBar } from "../StatusBar"
import type { TaskCardTask } from "@herbcaudill/beads-view"

// Mock the hooks from agent-view
vi.mock("@herbcaudill/agent-view", () => ({
  useTokenUsage: () => ({ input: 1000, output: 500 }),
  useContextWindow: () => ({ used: 5000, total: 128000 }),
  TokenUsageDisplay: ({ tokenUsage }: { tokenUsage: { input: number; output: number } }) => (
    <div data-testid="token-usage">
      {tokenUsage.input}in/{tokenUsage.output}out
    </div>
  ),
  ContextWindowProgress: ({ contextWindow }: { contextWindow: { used: number; total: number } }) => (
    <div data-testid="context-window">
      {contextWindow.used}/{contextWindow.total}
    </div>
  ),
}))

// Mock the session timer hook
vi.mock("@/hooks/useSessionTimer", () => ({
  useSessionTimer: () => ({ elapsedMs: 60000 }),
}))

// Mock the layout components
vi.mock("@/components/layout", () => ({
  RepoBranch: ({
    workspaceName,
    branch,
  }: {
    workspaceName?: string | null
    branch?: string | null
    workspacePath?: string | null
    className?: string
  }) => (
    <div data-testid="repo-branch">
      {workspaceName}:{branch}
    </div>
  ),
  RunDuration: ({ elapsedMs }: { elapsedMs: number; className?: string }) => (
    <div data-testid="run-duration">{elapsedMs}ms</div>
  ),
  SessionProgress: ({
    tasks,
  }: {
    tasks: unknown[]
    accentColor?: string | null
    className?: string
  }) => <div data-testid="session-progress">{tasks.length} tasks</div>,
  StatusIndicator: ({
    controlState,
  }: {
    controlState: string
    isStoppingAfterCurrent?: boolean
    className?: string
  }) => <div data-testid="status-indicator">{controlState}</div>,
}))

// Mock the ControlBar
vi.mock("@/components/controls/ControlBar", () => ({
  ControlBar: ({ controlState }: { controlState: string }) => (
    <div data-testid="control-bar">{controlState}</div>
  ),
}))

describe("StatusBar", () => {
  const mockTask: TaskCardTask = {
    id: "1",
    title: "Task 1",
    status: "closed",
  }

  const defaultProps = {
    connectionStatus: "connected" as const,
    workspacePath: "/test/path",
    events: [],
    error: null,
    controlState: "running" as const,
    isStoppingAfterCurrent: false,
    workspaceName: "test-workspace",
    branch: "main",
    tasks: [mockTask],
  }

  describe("layout structure", () => {
    it("renders ControlBar in the left section", () => {
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByTestId("control-bar")).toBeInTheDocument()
    })

    it("renders StatusIndicator after ControlBar in the left section", () => {
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByTestId("status-indicator")).toBeInTheDocument()
    })

    it("renders RunDuration in the left section", () => {
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByTestId("run-duration")).toBeInTheDocument()
    })

    it("renders RepoBranch in the right section", () => {
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByTestId("repo-branch")).toBeInTheDocument()
    })

    it("renders TokenUsage in the right section", () => {
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByTestId("token-usage")).toBeInTheDocument()
    })

    it("renders ContextWindow in the right section", () => {
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByTestId("context-window")).toBeInTheDocument()
    })

    it("renders SessionProgress in the right section", () => {
      render(<StatusBar {...defaultProps} />)
      expect(screen.getByTestId("session-progress")).toBeInTheDocument()
    })

    it("arranges components left-to-right: ControlBar, StatusIndicator, RunDuration | RepoBranch, TokenUsage, ContextWindow, SessionProgress", () => {
      const { container } = render(<StatusBar {...defaultProps} />)

      // Get all test ids in document order
      const allTestIds = Array.from(container.querySelectorAll("[data-testid]")).map(
        el => el.getAttribute("data-testid"),
      )

      // Verify the expected order
      const expectedOrder = [
        "control-bar",
        "status-indicator",
        "run-duration",
        "repo-branch",
        "token-usage",
        "context-window",
        "session-progress",
      ]

      // Filter to only the components we care about
      const relevantTestIds = allTestIds.filter(id => expectedOrder.includes(id!))

      expect(relevantTestIds).toEqual(expectedOrder)
    })
  })

  describe("conditional rendering", () => {
    it("does not render ControlBar when controlState is undefined", () => {
      render(<StatusBar {...defaultProps} controlState={undefined} />)
      expect(screen.queryByTestId("control-bar")).not.toBeInTheDocument()
    })

    it("does not render StatusIndicator when controlState is undefined", () => {
      render(<StatusBar {...defaultProps} controlState={undefined} />)
      expect(screen.queryByTestId("status-indicator")).not.toBeInTheDocument()
    })

    it("does not render RepoBranch when workspaceName and branch are not provided", () => {
      render(<StatusBar {...defaultProps} workspaceName={undefined} branch={undefined} />)
      expect(screen.queryByTestId("repo-branch")).not.toBeInTheDocument()
    })

    it("does not render SessionProgress when tasks is empty or undefined", () => {
      render(<StatusBar {...defaultProps} tasks={[]} />)
      expect(screen.queryByTestId("session-progress")).not.toBeInTheDocument()
    })

    it("renders error message when error is provided", () => {
      render(<StatusBar {...defaultProps} error="Something went wrong" />)
      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    })
  })
})
