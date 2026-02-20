import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { WorkspaceView } from "../WorkspaceView"
import type { ChatEvent } from "@herbcaudill/agent-view"
import type { RalphSessionIndexEntry } from "../../lib/fetchRalphSessions"
import type { WorkerInfo, OrchestratorState } from "../../hooks/useWorkerOrchestrator"

// ── Mock state that tests can mutate ───────────────────────────────────────

let mockSessionId: string | null = "live-session-1"
let mockLiveEvents: ChatEvent[] = [{ type: "assistant", timestamp: 1000 } as ChatEvent]
let mockIsStreaming = false
let mockControlState: "idle" | "running" | "paused" = "idle"

let mockSessions: RalphSessionIndexEntry[] = [
  {
    sessionId: "live-session-1",
    adapter: "claude",
    firstMessageAt: 1000,
    lastMessageAt: 3000,
    firstUserMessage: "task-1",
    taskId: "task-1",
    taskTitle: "Live session task",
  },
  {
    sessionId: "old-session-2",
    adapter: "claude",
    firstMessageAt: 500,
    lastMessageAt: 900,
    firstUserMessage: "task-2",
    taskId: "task-2",
    taskTitle: "Old session task",
  },
]

let mockHistoricalEvents: ChatEvent[] | null = null
let mockIsViewingHistorical = false
const mockSelectSession = vi.fn()
const mockClearHistorical = vi.fn()

// Mock orchestrator state
let mockOrchestratorState: OrchestratorState = "stopped"
let mockOrchestratorWorkers: Record<string, WorkerInfo> = {}
const mockOrchestratorStart = vi.fn()
const mockOrchestratorStop = vi.fn()
const mockOrchestratorStopAfterCurrent = vi.fn()
const mockOrchestratorCancelStop = vi.fn()
const mockPauseWorker = vi.fn()
const mockResumeWorker = vi.fn()
const mockStopWorker = vi.fn()

// Mock URL session ID (can be mutated per-test)
let mockUrlSessionId: string | undefined = undefined
const mockTaskChatSendMessage = vi.fn()
const mockTaskChatRestoreSession = vi.fn()
const mockTaskChatNewSession = vi.fn()
const mockTaskChatInputFocus = vi.fn()
let capturedTaskPanelProps: Record<string, unknown> | null = null
let capturedTaskDetailSheetProps: Record<string, unknown> | null = null
const workspaceMocks = vi.hoisted(() => {
  const mockSwitchWorkspace = vi.fn()
  const mockClearTasks = vi.fn()
  const mockUseWorkspace = vi.fn(() => ({
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
    actions: { switchWorkspace: mockSwitchWorkspace, refresh: vi.fn() },
  }))

  return { mockSwitchWorkspace, mockClearTasks, mockUseWorkspace }
})
const beadsMocks = vi.hoisted(() => ({
  selectedTaskId: null as string | null,
  mockSetSelectedTaskId: vi.fn(),
  mockOpenDialogById: vi.fn(),
  mockCloseDialog: vi.fn(),
}))

// Track navigate calls
const mockNavigate = vi.fn()

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("../../hooks/useWorkspaceParams", () => ({
  useWorkspaceParams: () => ({
    owner: "test",
    repo: "workspace",
    sessionId: mockUrlSessionId,
    workspaceId: "test/workspace",
  }),
}))

vi.mock("../../hooks/useRalphLoop", () => ({
  useRalphLoop: () => ({
    events: mockLiveEvents,
    isStreaming: mockIsStreaming,
    controlState: mockControlState,
    connectionStatus: "connected",
    sessionId: mockSessionId,
    isStoppingAfterCurrent: false,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    sendMessage: vi.fn(),
    stopAfterCurrent: vi.fn(),
    cancelStopAfterCurrent: vi.fn(),
  }),
}))

const mockRefetchSessions = vi.fn()

vi.mock("../../hooks/useRalphSessions", () => ({
  useRalphSessions: () => ({
    sessions: mockSessions,
    historicalEvents: mockHistoricalEvents,
    isViewingHistorical: mockIsViewingHistorical,
    selectSession: mockSelectSession,
    clearHistorical: mockClearHistorical,
    refetchSessions: mockRefetchSessions,
  }),
}))

// Capture the onSessionCreated callback passed to useWorkerOrchestrator
let capturedOrchestratorOnSessionCreated:
  | ((event: { workerName: string; sessionId: string }) => void)
  | undefined

vi.mock("../../hooks/useWorkerOrchestrator", () => ({
  useWorkerOrchestrator: (
    _workspaceId?: string,
    options?: { onSessionCreated?: (event: { workerName: string; sessionId: string }) => void },
  ) => {
    capturedOrchestratorOnSessionCreated = options?.onSessionCreated
    return {
      state: mockOrchestratorState,
      workers: mockOrchestratorWorkers,
      maxWorkers: 3,
      activeWorkerCount: Object.keys(mockOrchestratorWorkers).length,
      isConnected: true,
      activeSessionIds: [],
      latestSessionId: null,
      start: mockOrchestratorStart,
      stop: mockOrchestratorStop,
      stopAfterCurrent: mockOrchestratorStopAfterCurrent,
      cancelStopAfterCurrent: mockOrchestratorCancelStop,
      pauseWorker: mockPauseWorker,
      resumeWorker: mockResumeWorker,
      stopWorker: mockStopWorker,
    }
  },
}))

vi.mock("../../hooks/useTaskChat", () => ({
  useTaskChat: () => ({
    state: { events: [], isStreaming: false, sessionId: null },
    actions: {
      sendMessage: mockTaskChatSendMessage,
      restoreSession: mockTaskChatRestoreSession,
      newSession: mockTaskChatNewSession,
    },
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
  const getStoreState = () => ({
    selectedTaskId: beadsMocks.selectedTaskId,
    setSelectedTaskId: (taskId: string | null) => {
      beadsMocks.selectedTaskId = taskId
      beadsMocks.mockSetSelectedTaskId(taskId)
    },
    visibleTaskIds: [],
    accentColor: null,
    clearTasks: workspaceMocks.mockClearTasks,
    setAccentColor: vi.fn(),
    initialTaskCount: null,
    setInitialTaskCount: vi.fn(),
  })
  return {
    TaskPanelController: (props: Record<string, unknown>) => {
      capturedTaskPanelProps = props
      return <div data-testid="task-sidebar">Tasks</div>
    },
    BeadsViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    configureApiClient: vi.fn(),
    getApiClientConfig: vi.fn(() => ({ baseUrl: "" })),
    useTasks: () => ({ tasks: [], error: null, refresh: vi.fn() }),
    useTaskDialog: () => ({
      selectedTask: null,
      isOpen: false,
      openDialogById: beadsMocks.mockOpenDialogById,
      closeDialog: beadsMocks.mockCloseDialog,
    }),
    useBeadsViewStore: (selector: (state: ReturnType<typeof getStoreState>) => unknown) =>
      selector(getStoreState()),
    beadsViewStore: { getState: () => getStoreState() },
    selectSelectedTaskId: (state: { selectedTaskId: string | null }) => state.selectedTaskId,
    selectVisibleTaskIds: (state: { visibleTaskIds: string[] }) => state.visibleTaskIds,
    useWorkspace: workspaceMocks.mockUseWorkspace,
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
  // Hooks for deriving agent/model info
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
  TaskDetailSheet: (props: Record<string, unknown>) => {
    capturedTaskDetailSheetProps = props
    return null
  },
}))

vi.mock("../TaskChatPanel", () => ({
  TaskChatPanel: ({
    onNewSession,
    inputRef,
  }: {
    onNewSession: () => void
    inputRef?: { current: { focus: () => void } | null }
  }) => {
    if (inputRef) {
      inputRef.current = { focus: mockTaskChatInputFocus }
    }
    return (
      <div data-testid="task-chat-panel">
        Chat
        <button onClick={onNewSession}>New task chat session</button>
      </div>
    )
  },
}))

// Capture the props passed to Header so we can assert on them
let capturedHeaderProps: Record<string, unknown> = {}
vi.mock("../Header", () => ({
  Header: (props: Record<string, unknown>) => {
    capturedHeaderProps = props
    return <div data-testid="header">Header</div>
  },
}))

// Capture the props passed to RalphRunner so we can assert on them
let capturedRalphRunnerProps: Record<string, unknown> = {}
vi.mock("../RalphRunner", () => ({
  RalphRunner: (props: Record<string, unknown>) => {
    capturedRalphRunnerProps = props
    return <div data-testid="ralph-runner">Ralph Runner</div>
  },
}))

// Capture the props passed to WorkerControlBar so we can assert on them
let capturedWorkerControlBarProps: Record<string, unknown> | null = null
vi.mock("../WorkerControlBar", () => ({
  WorkerControlBar: (props: Record<string, unknown>) => {
    capturedWorkerControlBarProps = props
    const workers = props.workers as WorkerInfo[]
    if (workers.length === 0) return null
    return <div data-testid="worker-control-bar">Worker Control Bar</div>
  },
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

describe("WorkspaceView session history wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beadsMocks.selectedTaskId = null
    capturedHeaderProps = {}
    capturedRalphRunnerProps = {}
    capturedWorkerControlBarProps = null

    // Reset mock state to defaults
    mockSessionId = "live-session-1"
    mockLiveEvents = [{ type: "assistant", timestamp: 1000 } as ChatEvent]
    mockIsStreaming = false
    mockControlState = "idle"
    mockOrchestratorState = "stopped"
    mockOrchestratorWorkers = {}
    mockUrlSessionId = undefined
    mockSessions = [
      {
        sessionId: "live-session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 3000,
        firstUserMessage: "task-1",
        taskId: "task-1",
        taskTitle: "Live session task",
      },
      {
        sessionId: "old-session-2",
        adapter: "claude",
        firstMessageAt: 500,
        lastMessageAt: 900,
        firstUserMessage: "task-2",
        taskId: "task-2",
        taskTitle: "Old session task",
      },
    ]
    mockHistoricalEvents = null
    mockIsViewingHistorical = false
    workspaceMocks.mockSwitchWorkspace.mockReset()
  })

  describe("passing sessions and sessionId to RalphRunner", () => {
    it("passes the sessions list from useRalphSessions to RalphRunner", () => {
      renderWorkspaceView()
      expect(capturedRalphRunnerProps.sessions).toEqual(mockSessions)
    })

    it("passes the sessionId from useRalphLoop to RalphRunner", () => {
      renderWorkspaceView()
      expect(capturedRalphRunnerProps.sessionId).toBe("live-session-1")
    })

    it("passes historical viewed sessionId to RalphRunner when viewing history", () => {
      mockSessionId = "live-session-1"
      mockUrlSessionId = "old-session-2"
      mockIsViewingHistorical = true
      mockHistoricalEvents = [{ type: "assistant", timestamp: 500 } as ChatEvent]

      renderWorkspaceView()
      expect(capturedRalphRunnerProps.sessionId).toBe("old-session-2")
    })
  })

  describe("effective events (live vs historical)", () => {
    it("passes live events to RalphRunner when not viewing historical session", () => {
      mockHistoricalEvents = null
      mockIsViewingHistorical = false

      renderWorkspaceView()
      expect(capturedRalphRunnerProps.events).toEqual(mockLiveEvents)
    })

    it("passes historical events to RalphRunner when viewing a historical session", () => {
      const historicalEvents = [
        { type: "user_message", message: "old message", timestamp: 500 } as ChatEvent,
      ]
      mockHistoricalEvents = historicalEvents
      mockIsViewingHistorical = true

      renderWorkspaceView()
      expect(capturedRalphRunnerProps.events).toEqual(historicalEvents)
    })
  })

  describe("effective isStreaming", () => {
    it("passes live isStreaming when not viewing historical session", () => {
      mockIsStreaming = true
      mockIsViewingHistorical = false

      renderWorkspaceView()
      expect(capturedRalphRunnerProps.isStreaming).toBe(true)
    })

    it("passes false for isStreaming when viewing a historical session", () => {
      mockIsStreaming = true
      mockHistoricalEvents = [{ type: "assistant", timestamp: 500 } as ChatEvent]
      mockIsViewingHistorical = true

      renderWorkspaceView()
      expect(capturedRalphRunnerProps.isStreaming).toBe(false)
    })
  })

  describe("isViewingHistoricalSession prop", () => {
    it("passes false when not viewing historical session", () => {
      mockIsViewingHistorical = false

      renderWorkspaceView()
      expect(capturedRalphRunnerProps.isViewingHistoricalSession).toBe(false)
    })

    it("passes true when viewing a historical session", () => {
      mockIsViewingHistorical = true

      renderWorkspaceView()
      expect(capturedRalphRunnerProps.isViewingHistoricalSession).toBe(true)
    })
  })

  describe("onSelectSession handler", () => {
    it("passes an onSelectSession handler to RalphRunner", () => {
      renderWorkspaceView()
      expect(typeof capturedRalphRunnerProps.onSelectSession).toBe("function")
    })

    it("calls clearHistorical when selecting the current live session", () => {
      mockSessionId = "live-session-1"

      renderWorkspaceView()

      const handler = capturedRalphRunnerProps.onSelectSession as (id: string) => void
      handler("live-session-1")

      expect(mockClearHistorical).toHaveBeenCalled()
      expect(mockSelectSession).not.toHaveBeenCalled()
    })

    it("calls selectSession when selecting a different (historical) session", () => {
      mockSessionId = "live-session-1"

      renderWorkspaceView()

      const handler = capturedRalphRunnerProps.onSelectSession as (id: string) => void
      handler("old-session-2")

      expect(mockSelectSession).toHaveBeenCalledWith("old-session-2")
      expect(mockClearHistorical).not.toHaveBeenCalled()
    })
  })

  describe("task chat new session", () => {
    it("starts a new task chat session and focuses the task chat input", () => {
      renderWorkspaceView()

      fireEvent.click(screen.getByRole("button", { name: "New task chat session" }))

      expect(mockTaskChatNewSession).toHaveBeenCalledTimes(1)
      expect(mockTaskChatInputFocus).toHaveBeenCalledTimes(1)
    })
  })
})

describe("WorkspaceView workspace switching", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beadsMocks.selectedTaskId = null
  })

  it("passes clearTasks to useWorkspace onSwitchStart", () => {
    renderWorkspaceView()

    expect(workspaceMocks.mockUseWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ onSwitchStart: workspaceMocks.mockClearTasks }),
    )
  })
})

describe("WorkspaceView worker orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beadsMocks.selectedTaskId = null
    capturedHeaderProps = {}
    capturedRalphRunnerProps = {}
    capturedWorkerControlBarProps = null

    // Reset mock state to defaults
    mockSessionId = "live-session-1"
    mockLiveEvents = [{ type: "assistant", timestamp: 1000 } as ChatEvent]
    mockIsStreaming = false
    mockControlState = "idle"
    mockOrchestratorState = "stopped"
    mockOrchestratorWorkers = {}
    mockSessions = [
      {
        sessionId: "live-session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 3000,
        firstUserMessage: "task-1",
        taskId: "task-1",
        taskTitle: "Live session task",
      },
    ]
    mockHistoricalEvents = null
    mockIsViewingHistorical = false
  })

  describe("WorkerControlBar rendering", () => {
    it("does not render WorkerControlBar when there are no active workers", () => {
      mockOrchestratorWorkers = {}
      renderWorkspaceView()
      expect(screen.queryByTestId("worker-control-bar")).not.toBeInTheDocument()
    })

    it("renders WorkerControlBar when there are active workers", () => {
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentWorkId: "r-abc123" },
      }
      renderWorkspaceView()
      expect(screen.getByTestId("worker-control-bar")).toBeInTheDocument()
    })

    it("passes workers array to WorkerControlBar", () => {
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentWorkId: "r-abc123" },
        Homer: { workerName: "Homer", state: "paused", currentWorkId: "r-def456" },
      }
      renderWorkspaceView()

      const workers = capturedWorkerControlBarProps?.workers as WorkerInfo[]
      expect(workers).toHaveLength(2)
      expect(workers).toContainEqual({
        workerName: "Ralph",
        state: "running",
        currentWorkId: "r-abc123",
      })
      expect(workers).toContainEqual({
        workerName: "Homer",
        state: "paused",
        currentWorkId: "r-def456",
      })
    })

    it("passes isStoppingAfterCurrent when orchestrator is stopping", () => {
      mockOrchestratorState = "stopping"
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentWorkId: "r-abc123" },
      }
      renderWorkspaceView()

      expect(capturedWorkerControlBarProps?.isStoppingAfterCurrent).toBe(true)
    })

    it("passes isConnected to WorkerControlBar", () => {
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentWorkId: "r-abc123" },
      }
      renderWorkspaceView()

      expect(capturedWorkerControlBarProps?.isConnected).toBe(true)
    })
  })

  describe("WorkerControlBar callbacks", () => {
    beforeEach(() => {
      beadsMocks.selectedTaskId = null
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentWorkId: "r-abc123" },
      }
    })

    it("passes onPauseWorker callback", () => {
      renderWorkspaceView()

      const handler = capturedWorkerControlBarProps?.onPauseWorker as (name: string) => void
      handler("Ralph")

      expect(mockPauseWorker).toHaveBeenCalledWith("Ralph")
    })

    it("passes onResumeWorker callback", () => {
      renderWorkspaceView()

      const handler = capturedWorkerControlBarProps?.onResumeWorker as (name: string) => void
      handler("Ralph")

      expect(mockResumeWorker).toHaveBeenCalledWith("Ralph")
    })

    it("passes onStopWorker callback", () => {
      renderWorkspaceView()

      const handler = capturedWorkerControlBarProps?.onStopWorker as (name: string) => void
      handler("Ralph")

      expect(mockStopWorker).toHaveBeenCalledWith("Ralph")
    })

    it("passes onStopAfterCurrent callback", () => {
      renderWorkspaceView()

      const handler = capturedWorkerControlBarProps?.onStopAfterCurrent as () => void
      handler()

      expect(mockOrchestratorStopAfterCurrent).toHaveBeenCalled()
    })

    it("passes onCancelStopAfterCurrent callback", () => {
      renderWorkspaceView()

      const handler = capturedWorkerControlBarProps?.onCancelStopAfterCurrent as () => void
      handler()

      expect(mockOrchestratorCancelStop).toHaveBeenCalled()
    })
  })

  describe("orchestrator session creation events", () => {
    beforeEach(() => {
      capturedOrchestratorOnSessionCreated = undefined
      mockSessions = [
        {
          sessionId: "live-session-1",
          adapter: "claude",
          firstMessageAt: 1000,
          lastMessageAt: 3000,
          firstUserMessage: "task-1",
          taskId: "task-1",
          taskTitle: "Live session task",
        },
      ]
      mockHistoricalEvents = null
      mockIsViewingHistorical = false
    })

    it("passes onSessionCreated callback to useWorkerOrchestrator", () => {
      renderWorkspaceView()
      expect(capturedOrchestratorOnSessionCreated).toBeDefined()
    })

    it("calls refetchSessions when orchestrator creates a session", () => {
      renderWorkspaceView()
      expect(capturedOrchestratorOnSessionCreated).toBeDefined()

      capturedOrchestratorOnSessionCreated!({
        workerName: "Ralph",
        sessionId: "new-session-123",
      })

      expect(mockRefetchSessions).toHaveBeenCalled()
    })

    it("auto-selects the newly created session", () => {
      renderWorkspaceView()
      expect(capturedOrchestratorOnSessionCreated).toBeDefined()

      capturedOrchestratorOnSessionCreated!({
        workerName: "Ralph",
        sessionId: "new-session-123",
      })

      expect(mockSelectSession).toHaveBeenCalledWith("new-session-123")
    })

    it("updates URL to include the new session ID", () => {
      renderWorkspaceView()
      expect(capturedOrchestratorOnSessionCreated).toBeDefined()

      capturedOrchestratorOnSessionCreated!({
        workerName: "Ralph",
        sessionId: "new-session-123",
      })

      expect(mockNavigate).toHaveBeenCalledWith("/test/workspace/new-session-123", {
        replace: true,
      })
    })

    it("does not auto-select if viewing a historical session", () => {
      mockIsViewingHistorical = true
      mockHistoricalEvents = [{ type: "assistant", timestamp: 500 } as ChatEvent]

      renderWorkspaceView()
      expect(capturedOrchestratorOnSessionCreated).toBeDefined()

      capturedOrchestratorOnSessionCreated!({
        workerName: "Ralph",
        sessionId: "new-session-123",
      })

      // Should refetch but NOT auto-select
      expect(mockRefetchSessions).toHaveBeenCalled()
      expect(mockSelectSession).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})

describe("WorkspaceView Header agent/model and workspace props", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beadsMocks.selectedTaskId = null
    capturedHeaderProps = {}
    capturedRalphRunnerProps = {}
    capturedWorkerControlBarProps = null

    // Reset mock state to defaults
    mockSessionId = "live-session-1"
    mockLiveEvents = [{ type: "assistant", timestamp: 1000 } as ChatEvent]
    mockIsStreaming = false
    mockControlState = "idle"
    mockOrchestratorState = "stopped"
    mockOrchestratorWorkers = {}
    mockSessions = []
    mockHistoricalEvents = null
    mockIsViewingHistorical = false
  })

  describe("agent/model info props", () => {
    it("passes agentDisplayName to Header", () => {
      renderWorkspaceView()
      // Should be capitalized adapter name (e.g., "Claude")
      expect(capturedHeaderProps.agentDisplayName).toBe("Claude")
    })

    it("passes modelName to Header", () => {
      renderWorkspaceView()
      // Should be formatted model name (e.g., "Sonnet 4")
      expect(capturedHeaderProps.modelName).toBe("Sonnet 4")
    })
  })

  describe("workspace info props", () => {
    it("does not pass workspace name/branch/path directly to Header (shown in WorkspaceSelector)", () => {
      // The Header no longer receives workspaceName, branch, or workspacePath props.
      // This information is now shown via the WorkspaceSelector component.
      renderWorkspaceView()
      expect(capturedHeaderProps.workspaceName).toBeUndefined()
      expect(capturedHeaderProps.branch).toBeUndefined()
      expect(capturedHeaderProps.workspacePath).toBeUndefined()
    })
  })
})

describe("WorkspaceView session ID URL integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beadsMocks.selectedTaskId = null
    capturedHeaderProps = {}
    capturedRalphRunnerProps = {}
    capturedWorkerControlBarProps = null

    // Reset mock state to defaults
    mockSessionId = "live-session-1"
    mockLiveEvents = [{ type: "assistant", timestamp: 1000 } as ChatEvent]
    mockIsStreaming = false
    mockControlState = "idle"
    mockOrchestratorState = "stopped"
    mockOrchestratorWorkers = {}
    mockUrlSessionId = undefined
    mockSessions = [
      {
        sessionId: "live-session-1",
        adapter: "claude",
        firstMessageAt: 1000,
        lastMessageAt: 3000,
        firstUserMessage: "task-1",
        taskId: "task-1",
        taskTitle: "Live session task",
      },
      {
        sessionId: "old-session-2",
        adapter: "claude",
        firstMessageAt: 500,
        lastMessageAt: 900,
        firstUserMessage: "task-2",
        taskId: "task-2",
        taskTitle: "Old session task",
      },
    ]
    mockHistoricalEvents = null
    mockIsViewingHistorical = false
  })

  describe("loading session from URL", () => {
    it("calls selectSession when URL has a session ID different from live session", () => {
      mockUrlSessionId = "old-session-2"
      mockSessionId = "live-session-1"

      renderWorkspaceView()

      expect(mockSelectSession).toHaveBeenCalledWith("old-session-2")
    })

    it("does not call selectSession when URL session ID matches live session", () => {
      mockUrlSessionId = "live-session-1"
      mockSessionId = "live-session-1"

      renderWorkspaceView()

      expect(mockSelectSession).not.toHaveBeenCalled()
    })

    it("does not call selectSession when no session ID in URL", () => {
      mockUrlSessionId = undefined
      mockSessionId = "live-session-1"

      renderWorkspaceView()

      expect(mockSelectSession).not.toHaveBeenCalled()
    })
  })

  describe("updating URL when session changes", () => {
    it("updates URL when selecting a historical session via onSelectSession", () => {
      mockSessionId = "live-session-1"
      mockUrlSessionId = undefined

      renderWorkspaceView()

      const handler = capturedRalphRunnerProps.onSelectSession as (id: string) => void
      handler("old-session-2")

      expect(mockNavigate).toHaveBeenCalledWith("/test/workspace/old-session-2", { replace: true })
    })

    it("updates URL to workspace root when selecting the live session", () => {
      mockSessionId = "live-session-1"
      mockUrlSessionId = "old-session-2"

      renderWorkspaceView()

      const handler = capturedRalphRunnerProps.onSelectSession as (id: string) => void
      handler("live-session-1")

      expect(mockNavigate).toHaveBeenCalledWith("/test/workspace", { replace: true })
    })
  })
})

describe("WorkspaceView task hash navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beadsMocks.selectedTaskId = null
    capturedTaskPanelProps = null
    capturedTaskDetailSheetProps = null
    window.location.hash = ""
  })

  it("sets #taskid hash when opening a task", () => {
    renderWorkspaceView()

    const onTaskClick = capturedTaskPanelProps?.onTaskClick as
      | ((taskId: string) => void)
      | undefined
    onTaskClick?.("r-eg7ui")

    expect(window.location.hash).toBe("#taskid=r-eg7ui")
  })

  it("clears hash when closing task sheet", () => {
    renderWorkspaceView()

    const onTaskClick = capturedTaskPanelProps?.onTaskClick as
      | ((taskId: string) => void)
      | undefined
    onTaskClick?.("r-eg7ui")

    const onClose = capturedTaskDetailSheetProps?.onClose as (() => void) | undefined
    onClose?.()

    expect(window.location.hash).toBe("")
  })

  it("opens task from URL hash on initial load", () => {
    window.location.hash = "#taskid=r-eg7ui"

    renderWorkspaceView()

    expect(beadsMocks.mockSetSelectedTaskId).toHaveBeenCalledWith("r-eg7ui")
    expect(beadsMocks.mockOpenDialogById).toHaveBeenCalledWith("r-eg7ui")
  })

  it("opens task when hash changes to include task ID", () => {
    renderWorkspaceView()
    expect(beadsMocks.mockOpenDialogById).not.toHaveBeenCalled()

    window.location.hash = "#taskid=r-eg7ui"
    window.dispatchEvent(new HashChangeEvent("hashchange"))

    expect(beadsMocks.mockSetSelectedTaskId).toHaveBeenCalledWith("r-eg7ui")
    expect(beadsMocks.mockOpenDialogById).toHaveBeenCalledWith("r-eg7ui")
  })

  it("closes task when hash is removed", () => {
    beadsMocks.selectedTaskId = "r-eg7ui"
    window.location.hash = "#taskid=r-eg7ui"

    renderWorkspaceView()

    window.location.hash = ""
    window.dispatchEvent(new HashChangeEvent("hashchange"))

    expect(beadsMocks.mockSetSelectedTaskId).toHaveBeenCalledWith(null)
    expect(beadsMocks.mockCloseDialog).toHaveBeenCalled()
  })
})
