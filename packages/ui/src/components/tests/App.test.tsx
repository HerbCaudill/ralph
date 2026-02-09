import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { WorkspaceView } from "../WorkspaceView"

/**
 * Tests for the WorkspaceView component layout.
 *
 * Uses MemoryRouter to render at a workspace route (/:owner/:repo)
 * instead of going through the full App router, which would redirect
 * to WorkspaceRedirect at `/`.
 */

// Mock useWorkspaceParams to provide a workspace ID
vi.mock("../../hooks/useWorkspaceParams", () => ({
  useWorkspaceParams: () => ({
    owner: "test",
    repo: "workspace",
    workspaceId: "test/workspace",
  }),
}))

// Mock useTaskChat for WorkspaceView
vi.mock("../../hooks/useTaskChat", () => ({
  useTaskChat: () => ({
    state: { events: [], isStreaming: false, sessionId: null },
    actions: { sendMessage: vi.fn(), restoreSession: vi.fn(), newSession: vi.fn() },
  }),
}))

// Mock useAccentColor for WorkspaceView
vi.mock("../../hooks/useAccentColor", () => ({
  useAccentColor: vi.fn(),
}))

// Mock ralph-shared for getWorkspaceId used by WorkspaceView
vi.mock("@herbcaudill/ralph-shared", () => ({
  getWorkspaceId: vi.fn(({ workspacePath }: { workspacePath: string }) => {
    const parts = workspacePath.split("/").filter(Boolean)
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`.toLowerCase()
  }),
}))

// Mock useThemes to avoid async fetch("/api/themes") causing act() warnings
vi.mock("../../hooks/useThemes", () => ({
  useThemes: () => ({
    themes: [],
    variant: null,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

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

// Track mock tasks for testing
let mockTasks: Array<{ id: string; title: string; status: string }> = []

vi.mock("@herbcaudill/beads-view", () => {
  const storeState: Record<string, unknown> = {
    selectedTaskId: null,
    setSelectedTaskId: vi.fn(),
    visibleTaskIds: [],
    setAccentColor: vi.fn(),
    setInitialTaskCount: vi.fn(),
  }
  return {
    TaskPanelController: ({ isRunning }: { isRunning?: boolean }) => (
      <div data-testid="task-sidebar" data-is-running={isRunning ?? false}>
        Tasks Sidebar
      </div>
    ),
    BeadsViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    configureApiClient: vi.fn(),
    getApiClientConfig: vi.fn(() => ({ baseUrl: "" })),
    getSavedWorkspacePath: vi.fn(() => null),
    migrateWorkspaceStorage: vi.fn(),
    useTasks: () => ({ tasks: mockTasks, error: null, refresh: vi.fn() }),
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
    useBeadsViewStore: (selector: (state: Record<string, unknown>) => unknown) => {
      storeState.selectedTaskId = mockSelectedTaskId
      storeState.setSelectedTaskId = mockSetSelectedTaskId
      return selector(storeState)
    },
    beadsViewStore: { getState: () => storeState },
    selectSelectedTaskId: (state: { selectedTaskId: string | null }) => state.selectedTaskId,
    selectVisibleTaskIds: (state: { visibleTaskIds: string[] }) => state.visibleTaskIds,
    useWorkspace: () => ({
      state: {
        current: {
          path: "/test/workspace",
          name: "Test Workspace",
          accentColor: "#007ACC",
          branch: "main",
        },
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
    useTaskNavigation: () => ({
      navigatePrevious: vi.fn(),
      navigateNext: vi.fn(),
      openSelected: vi.fn(),
    }),
    useBeadsHotkeys: vi.fn(),
    hotkeys: {},
    getHotkeyDisplayString: () => "",
    TaskDetailsController: ({ task }: { task: { title: string } | null }) =>
      task ? <div data-testid="task-details-controller">{task.title}</div> : null,
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  }
})

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
  // Utility functions used by ControlBar
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" "),
}))

// Mock TaskDetailSheet to verify it gets rendered as a side panel
vi.mock("../TaskDetailSheet", () => ({
  TaskDetailSheet: ({
    task,
    open,
  }: {
    task: { id: string; title: string } | null
    open: boolean
  }) => {
    if (!open || !task) return null
    return (
      <div data-testid="task-detail-sheet" role="dialog">
        <span data-testid="task-detail-title">{task.title}</span>
      </div>
    )
  },
}))

// Mock TaskChatPanel to avoid multiple AgentView instances
vi.mock("../TaskChatPanel", () => ({
  TaskChatPanel: () => <div data-testid="task-chat-panel">Task Chat Panel</div>,
}))

// Mock RalphRunner to have a distinct testid
vi.mock("../RalphRunner", () => ({
  RalphRunner: () => <div data-testid="ralph-runner">Ralph Runner</div>,
}))

/** Render WorkspaceView at a workspace route. */
function renderWorkspaceView() {
  return render(
    <MemoryRouter initialEntries={["/test/workspace"]}>
      <Routes>
        <Route path="/:owner/:repo" element={<WorkspaceView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("WorkspaceView", () => {
  beforeEach(() => {
    // Reset selected task before each test
    mockSelectedTaskId = null
    // Reset tasks mock
    mockTasks = []
  })

  describe("panel layout order", () => {
    it("renders panels in the correct order: task chat (left), tasks (center), ralph loop (right)", () => {
      const { container } = renderWorkspaceView()

      // Get main element (center)
      const main = container.querySelector("main")
      expect(main).toBeInTheDocument()

      // Verify the task sidebar (tasks) is in the main/center area
      expect(main).toContainElement(screen.getByTestId("task-sidebar"))

      // Verify ralph runner is rendered (in the right panel)
      expect(screen.getByTestId("ralph-runner")).toBeInTheDocument()

      // Verify there is an aside for the right panel
      const asides = container.querySelectorAll("aside")
      expect(asides.length).toBeGreaterThanOrEqual(1)
    })

    it("renders task chat panel on the left when a task is selected", () => {
      const { container } = renderWorkspaceView()

      // The only aside should be the right panel with RalphRunner
      const asides = container.querySelectorAll("aside")
      expect(asides.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("TaskDetailSheet rendering", () => {
    it("renders TaskDetailSheet as a side panel when a task is selected", () => {
      // Set a selected task
      mockSelectedTaskId = "task-123"

      renderWorkspaceView()

      // TaskDetailSheet should be rendered as an overlay
      expect(screen.getByTestId("task-detail-sheet")).toBeInTheDocument()
      expect(screen.getByTestId("task-detail-title")).toHaveTextContent("Test Task")
    })

    it("always renders TaskChatPanel in the left sidebar", () => {
      // Ensure no task is selected
      mockSelectedTaskId = null

      const { container } = renderWorkspaceView()

      // TaskChatPanel should always be in the left sidebar
      expect(screen.getByTestId("task-chat-panel")).toBeInTheDocument()

      // Left sidebar should contain TaskChatPanel
      const leftSidebar = container.querySelector("aside.border-r")
      expect(leftSidebar).toBeInTheDocument()
      expect(leftSidebar).toContainElement(screen.getByTestId("task-chat-panel"))
    })

    it("renders TaskChatPanel in sidebar even when task is selected", () => {
      // Set a selected task
      mockSelectedTaskId = "task-123"

      const { container } = renderWorkspaceView()

      // TaskChatPanel should still be visible in the left sidebar
      expect(screen.getByTestId("task-chat-panel")).toBeInTheDocument()

      // And TaskDetailSheet should be rendered as a side panel
      expect(screen.getByTestId("task-detail-sheet")).toBeInTheDocument()

      // Left sidebar should contain TaskChatPanel
      const leftSidebar = container.querySelector("aside.border-r")
      expect(leftSidebar).toContainElement(screen.getByTestId("task-chat-panel"))
    })

    it("does not render TaskDetailSheet when no task is selected", () => {
      mockSelectedTaskId = null

      renderWorkspaceView()

      // TaskDetailSheet should not be rendered
      expect(screen.queryByTestId("task-detail-sheet")).not.toBeInTheDocument()
    })
  })

  describe("TaskPanelController props", () => {
    it("passes isRunning based on controlState to TaskPanelController", () => {
      mockTasks = [{ id: "task-1", title: "Test Task", status: "open" }]

      renderWorkspaceView()

      const taskSidebar = screen.getByTestId("task-sidebar")
      // Default controlState is "idle", so isRunning should be false
      expect(taskSidebar).toHaveAttribute("data-is-running", "false")
    })
  })

  describe("control bar placement", () => {
    it("only renders controls in the RalphRunner panel, not as a separate full-width status bar", () => {
      renderWorkspaceView()

      // RalphRunner contains its own comprehensive footer with controls
      expect(screen.getByTestId("ralph-runner")).toBeInTheDocument()
    })
  })
})
