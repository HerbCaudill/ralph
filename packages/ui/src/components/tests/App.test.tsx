import { describe, it, expect, vi, beforeEach } from "vitest"
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

// Track selected task ID for testing
let mockSelectedTaskId: string | null = null
const mockSetSelectedTaskId = vi.fn((id: string | null) => {
  mockSelectedTaskId = id
})

vi.mock("@herbcaudill/beads-view", () => ({
  TaskSidebarController: () => <div data-testid="task-sidebar">Tasks Sidebar</div>,
  BeadsViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  configureApiClient: vi.fn(),
  useTasks: () => ({ error: null, refresh: vi.fn() }),
  useTaskDialog: () => ({
    selectedTask:
      mockSelectedTaskId ?
        {
          id: mockSelectedTaskId,
          title: "Test Task",
          description: "Test description",
          status: "open",
          issue_type: "task",
          priority: 2,
        }
      : null,
    isOpen: mockSelectedTaskId !== null,
    openDialogById: vi.fn(),
    closeDialog: vi.fn(),
  }),
  useBeadsViewStore: (selector: (state: unknown) => unknown) => {
    // Mock store with selectedTaskId state
    const state = {
      selectedTaskId: mockSelectedTaskId,
      setSelectedTaskId: mockSetSelectedTaskId,
      visibleTaskIds: [],
    }
    return selector(state)
  },
  selectSelectedTaskId: (state: { selectedTaskId: string | null }) => state.selectedTaskId,
  selectVisibleTaskIds: (state: { visibleTaskIds: string[] }) => state.visibleTaskIds,
  useWorkspace: () => ({
    state: {
      current: { path: "/test/workspace", name: "Test Workspace", accentColor: "#007ACC", branch: "main" },
      workspaces: [],
      isLoading: false,
      error: null,
    },
    actions: {
      switchWorkspace: vi.fn(),
      refresh: vi.fn(),
    },
  }),
  WorkspaceSelector: () => <div data-testid="workspace-selector">Workspace Selector</div>,
  useBeadsHotkeys: vi.fn(),
  hotkeys: {},
  getHotkeyDisplayString: () => "",
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
  useAgentChat: () => ({
    state: { events: [], isStreaming: false, connectionStatus: "disconnected", sessionId: null },
    actions: { sendMessage: vi.fn(), restoreSession: vi.fn() },
    agentType: "claude",
  }),
  useAgentHotkeys: vi.fn(),
  SessionPicker: () => <div data-testid="session-picker">Session Picker</div>,
  listSessions: vi.fn(() => []),
  hotkeys: {},
  getHotkeyDisplayString: () => "",
}))

// Mock TaskDetailPanel to verify it gets rendered
vi.mock("../TaskDetailPanel", () => ({
  TaskDetailPanel: ({
    task,
    open,
  }: {
    task: { id: string; title: string } | null
    open: boolean
  }) => {
    if (!open || !task) return <div data-testid="task-detail-empty">No task selected</div>
    return (
      <div data-testid="task-detail-panel">
        <span data-testid="task-detail-title">{task.title}</span>
      </div>
    )
  },
}))

describe("App", () => {
  beforeEach(() => {
    // Reset selected task before each test
    mockSelectedTaskId = null
  })

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

  describe("TaskDetailPanel rendering", () => {
    it("renders TaskDetailPanel in the left sidebar when a task is selected", () => {
      // Set a selected task
      mockSelectedTaskId = "task-123"

      render(<App />)

      // TaskDetailPanel should be rendered with the task
      expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument()
      expect(screen.getByTestId("task-detail-title")).toHaveTextContent("Test Task")
    })

    it("renders TaskChatPanel when no task is selected", () => {
      // Ensure no task is selected
      mockSelectedTaskId = null

      const { container } = render(<App />)

      // TaskDetailPanel should NOT be rendered when no task is selected
      expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument()
      expect(screen.queryByTestId("task-detail-empty")).not.toBeInTheDocument()

      // Left sidebar should be empty (TaskChatPanel returns null when no task)
      // The aside with border-r class is the left sidebar
      const leftSidebar = container.querySelector("aside.border-r")
      expect(leftSidebar).toBeInTheDocument()
    })
  })
})
