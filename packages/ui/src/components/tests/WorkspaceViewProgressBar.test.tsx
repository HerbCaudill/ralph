import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { WorkspaceView } from "../WorkspaceView"

// ── Mock state that tests can mutate ───────────────────────────────────────

let mockControlState: "idle" | "running" | "paused" = "idle"
let mockTasks: { id: string; title: string; status: string }[] = []
let mockWorkspace: { path: string; name: string; accentColor: string | null; branch: string } = {
  path: "/test/workspace",
  name: "Test Workspace",
  accentColor: "#007ACC",
  branch: "main",
}

// Track store setter calls - use vi.hoisted so they're available in vi.mock factories
const { mockSetInitialTaskCount, mockSetAccentColor } = vi.hoisted(() => ({
  mockSetInitialTaskCount: vi.fn(),
  mockSetAccentColor: vi.fn(),
}))

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../hooks/useWorkspaceParams", () => ({
  useWorkspaceParams: () => ({
    owner: "test",
    repo: "workspace",
    workspaceId: "test/workspace",
  }),
}))

vi.mock("../../hooks/useRalphLoop", () => ({
  useRalphLoop: () => ({
    events: [],
    isStreaming: false,
    controlState: mockControlState,
    connectionStatus: "connected",
    sessionId: null,
    isStoppingAfterCurrent: false,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    sendMessage: vi.fn(),
    stopAfterCurrent: vi.fn(),
    cancelStopAfterCurrent: vi.fn(),
  }),
}))

vi.mock("../../hooks/useRalphSessions", () => ({
  useRalphSessions: () => ({
    sessions: [],
    historicalEvents: null,
    isViewingHistorical: false,
    selectSession: vi.fn(),
    clearHistorical: vi.fn(),
  }),
}))

vi.mock("../../hooks/useTaskChat", () => ({
  useTaskChat: () => ({
    state: { events: [], isStreaming: false, sessionId: null },
    actions: { sendMessage: vi.fn(), restoreSession: vi.fn(), newSession: vi.fn() },
  }),
}))

vi.mock("../../hooks/useAccentColor", () => ({
  useAccentColor: vi.fn(),
}))

vi.mock("../../hooks/useThemes", () => ({
  useThemes: () => ({
    themes: [],
    variant: null,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock("@herbcaudill/ralph-shared", () => ({
  getWorkspaceId: vi.fn(({ workspacePath }: { workspacePath: string }) => {
    const parts = workspacePath.split("/").filter(Boolean)
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`.toLowerCase()
  }),
}))

vi.mock("@herbcaudill/beads-view", () => {
  const storeState = {
    selectedTaskId: null,
    setSelectedTaskId: vi.fn(),
    visibleTaskIds: [],
    setInitialTaskCount: mockSetInitialTaskCount,
    setAccentColor: mockSetAccentColor,
  }
  const useBeadsViewStore = (selector: (state: typeof storeState) => unknown) =>
    selector(storeState)
  const beadsViewStore = { getState: () => storeState }
  return {
    TaskPanelController: () => <div data-testid="task-sidebar">Tasks</div>,
    BeadsViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    configureApiClient: vi.fn(),
    getApiClientConfig: vi.fn(() => ({ baseUrl: "" })),
    useTasks: () => ({ tasks: mockTasks, error: null, refresh: vi.fn() }),
    useTaskDialog: () => ({
      selectedTask: null,
      isOpen: false,
      openDialogById: vi.fn(),
      closeDialog: vi.fn(),
    }),
    useBeadsViewStore,
    beadsViewStore,
    selectSelectedTaskId: (state: { selectedTaskId: string | null }) => state.selectedTaskId,
    selectVisibleTaskIds: (state: { visibleTaskIds: string[] }) => state.visibleTaskIds,
    useWorkspace: () => ({
      state: {
        current: mockWorkspace,
        workspaces: [],
        isLoading: false,
        error: null,
      },
      actions: { switchWorkspace: vi.fn(), refresh: vi.fn() },
    }),
    WorkspaceSelector: () => <div data-testid="workspace-selector">Workspace</div>,
    useTaskNavigation: () => ({
      navigatePrevious: vi.fn(),
      navigateNext: vi.fn(),
      openSelected: vi.fn(),
    }),
    useBeadsHotkeys: vi.fn(),
    hotkeys: {},
    getHotkeyDisplayString: () => "",
    TaskDetailsController: () => null,
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    useTaskMutations: () => ({ isConnected: false }),
  }
})

vi.mock("@herbcaudill/agent-view", () => ({
  AgentView: () => <div data-testid="agent-view">Agent View</div>,
  AgentViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AgentControls: () => <div data-testid="agent-controls">Controls</div>,
  ChatInput: () => <div data-testid="chat-input">Chat</div>,
  useTokenUsage: () => ({ input: 0, output: 0 }),
  useContextWindow: () => ({ used: 0, max: 100000 }),
  TokenUsageDisplay: () => <div data-testid="token-usage">Tokens</div>,
  ContextWindowProgress: () => <div data-testid="context-progress">Context</div>,
  useAgentChat: () => ({
    state: { events: [], isStreaming: false, connectionStatus: "disconnected", sessionId: null },
    actions: { sendMessage: vi.fn(), restoreSession: vi.fn() },
    agentType: "claude",
  }),
  useAgentHotkeys: vi.fn(),
  SessionPicker: () => <div data-testid="session-picker">Sessions</div>,
  listSessions: vi.fn(() => []),
  hotkeys: {},
  getHotkeyDisplayString: () => "",
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" "),
  // Hooks for deriving agent/model info in WorkspaceView
  useAdapterInfo: () => ({ model: "claude-sonnet-4-20250514" }),
  useDetectedModel: () => "claude-sonnet-4-20250514",
  formatModelName: (model: string | null) => {
    if (!model) return null
    if (model.includes("sonnet")) return "Sonnet 4"
    if (model.includes("opus")) return "Opus 4"
    return model
  },
}))

vi.mock("../TaskDetailSheet", () => ({
  TaskDetailSheet: () => null,
}))

vi.mock("../TaskChatPanel", () => ({
  TaskChatPanel: () => <div data-testid="task-chat-panel">Chat</div>,
}))

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

describe("WorkspaceView progress bar store wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockControlState = "idle"
    mockTasks = []
    mockWorkspace = {
      path: "/test/workspace",
      name: "Test Workspace",
      accentColor: "#007ACC",
      branch: "main",
    }
  })

  describe("accent color syncing", () => {
    it("sets accent color from workspace on render", () => {
      mockWorkspace.accentColor = "#ff5500"
      renderWorkspaceView()
      expect(mockSetAccentColor).toHaveBeenCalledWith("#ff5500")
    })

    it("sets accent color to null when workspace has no accent color", () => {
      mockWorkspace.accentColor = null
      renderWorkspaceView()
      expect(mockSetAccentColor).toHaveBeenCalledWith(null)
    })
  })

  describe("initial task count syncing", () => {
    it("sets initialTaskCount when running with tasks", () => {
      mockControlState = "running"
      mockTasks = [
        { id: "1", title: "Task 1", status: "open" },
        { id: "2", title: "Task 2", status: "closed" },
      ]
      renderWorkspaceView()
      expect(mockSetInitialTaskCount).toHaveBeenCalledWith(2)
    })

    it("sets initialTaskCount to null when idle", () => {
      mockControlState = "idle"
      mockTasks = [{ id: "1", title: "Task 1", status: "open" }]
      renderWorkspaceView()
      expect(mockSetInitialTaskCount).toHaveBeenCalledWith(null)
    })

    it("sets initialTaskCount to null when running with no tasks", () => {
      mockControlState = "running"
      mockTasks = []
      renderWorkspaceView()
      expect(mockSetInitialTaskCount).toHaveBeenCalledWith(null)
    })

    it("sets initialTaskCount when paused with tasks", () => {
      mockControlState = "paused"
      mockTasks = [
        { id: "1", title: "Task 1", status: "open" },
        { id: "2", title: "Task 2", status: "closed" },
        { id: "3", title: "Task 3", status: "in_progress" },
      ]
      renderWorkspaceView()
      expect(mockSetInitialTaskCount).toHaveBeenCalledWith(3)
    })
  })
})
