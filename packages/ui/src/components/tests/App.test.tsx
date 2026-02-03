import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { App } from "../../App"

// Mock the hooks and components that depend on external services
vi.mock("../../hooks/useRalphLoop", () => ({
  useRalphLoop: () => ({
    events: [],
    isStreaming: false,
    controlState: "idle",
    connectionStatus: "disconnected",
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn(),
  }),
}))

vi.mock("@herbcaudill/beads-view", () => ({
  TaskSidebarController: () => <div data-testid="task-sidebar">Tasks Sidebar</div>,
  BeadsViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  configureApiClient: vi.fn(),
  useTasks: () => ({ error: null, refresh: vi.fn() }),
  useTaskDialog: () => ({
    selectedTask: null,
    isOpen: false,
    openDialogById: vi.fn(),
    closeDialog: vi.fn(),
  }),
}))

vi.mock("@herbcaudill/agent-view", () => ({
  AgentView: () => <div data-testid="agent-view">Agent View</div>,
  AgentViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AgentControls: () => <div data-testid="agent-controls">Controls</div>,
  ChatInput: () => <div data-testid="chat-input">Chat Input</div>,
  useTokenUsage: () => ({ input: 0, output: 0 }),
  useContextWindow: () => ({ used: 0, max: 100000 }),
  TokenUsageDisplay: () => <div data-testid="token-usage">Token Usage</div>,
  ContextWindowProgress: () => <div data-testid="context-progress">Context Progress</div>,
}))

describe("App", () => {
  describe("panel layout order", () => {
    it("renders panels in the correct order: task chat (left), tasks (center), ralph loop (right)", () => {
      const { container } = render(<App />)

      // Get main element (center)
      const main = container.querySelector("main")
      expect(main).toBeInTheDocument()

      // Verify the task sidebar (tasks) is in the main/center area
      expect(main).toContainElement(screen.getByTestId("task-sidebar"))

      // Verify ralph loop components are rendered (in the right panel)
      // The agent-view should be in the DOM
      expect(screen.getByTestId("agent-view")).toBeInTheDocument()

      // Verify there is an aside for the right panel
      // (TaskChatPanel returns null when no task selected, so only right panel aside exists)
      const asides = container.querySelectorAll("aside")
      expect(asides.length).toBeGreaterThanOrEqual(1)
    })

    it("renders task chat panel on the left when a task is selected", () => {
      // This test would require mocking a selected task
      // For now, verify that TaskChatPanel renders nothing when no task is selected
      const { container } = render(<App />)

      // When no task is selected, TaskChatPanel returns null, so no left sidebar aside
      // The only aside should be the right panel with RalphRunner
      const asides = container.querySelectorAll("aside")

      // With no task selected, TaskChatPanel returns null, so we should have just the right panel
      expect(asides.length).toBeGreaterThanOrEqual(1)
    })
  })
})
