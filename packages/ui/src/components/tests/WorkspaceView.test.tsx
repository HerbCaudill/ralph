import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
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

vi.mock("../../hooks/useRalphSessions", () => ({
  useRalphSessions: () => ({
    sessions: mockSessions,
    historicalEvents: mockHistoricalEvents,
    isViewingHistorical: mockIsViewingHistorical,
    selectSession: mockSelectSession,
    clearHistorical: mockClearHistorical,
  }),
}))

vi.mock("../../hooks/useWorkerOrchestrator", () => ({
  useWorkerOrchestrator: () => ({
    state: mockOrchestratorState,
    workers: mockOrchestratorWorkers,
    maxWorkers: 3,
    activeWorkerCount: Object.keys(mockOrchestratorWorkers).length,
    isConnected: true,
    start: mockOrchestratorStart,
    stop: mockOrchestratorStop,
    stopAfterCurrent: mockOrchestratorStopAfterCurrent,
    cancelStopAfterCurrent: mockOrchestratorCancelStop,
    pauseWorker: mockPauseWorker,
    resumeWorker: mockResumeWorker,
    stopWorker: mockStopWorker,
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
    accentColor: null,
    setAccentColor: vi.fn(),
    initialTaskCount: null,
    setInitialTaskCount: vi.fn(),
  }
  return {
    TaskPanelController: () => <div data-testid="task-sidebar">Tasks</div>,
    BeadsViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    configureApiClient: vi.fn(),
    getApiClientConfig: vi.fn(() => ({ baseUrl: "" })),
    useTasks: () => ({ tasks: [], error: null, refresh: vi.fn() }),
    useTaskDialog: () => ({
      selectedTask: null,
      isOpen: false,
      openDialogById: vi.fn(),
      closeDialog: vi.fn(),
    }),
    useBeadsViewStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
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
}))

vi.mock("../TaskDetailSheet", () => ({
  TaskDetailSheet: () => null,
}))

vi.mock("../TaskChatPanel", () => ({
  TaskChatPanel: () => <div data-testid="task-chat-panel">Chat</div>,
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

  describe("passing sessions and sessionId to RalphRunner", () => {
    it("passes the sessions list from useRalphSessions to RalphRunner", () => {
      renderWorkspaceView()
      expect(capturedRalphRunnerProps.sessions).toEqual(mockSessions)
    })

    it("passes the sessionId from useRalphLoop to RalphRunner", () => {
      renderWorkspaceView()
      expect(capturedRalphRunnerProps.sessionId).toBe("live-session-1")
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
})

describe("WorkspaceView worker orchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
        Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
      }
      renderWorkspaceView()
      expect(screen.getByTestId("worker-control-bar")).toBeInTheDocument()
    })

    it("passes workers array to WorkerControlBar", () => {
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
        Homer: { workerName: "Homer", state: "paused", currentTaskId: "r-def456" },
      }
      renderWorkspaceView()

      const workers = capturedWorkerControlBarProps?.workers as WorkerInfo[]
      expect(workers).toHaveLength(2)
      expect(workers).toContainEqual({
        workerName: "Ralph",
        state: "running",
        currentTaskId: "r-abc123",
      })
      expect(workers).toContainEqual({
        workerName: "Homer",
        state: "paused",
        currentTaskId: "r-def456",
      })
    })

    it("passes isStoppingAfterCurrent when orchestrator is stopping", () => {
      mockOrchestratorState = "stopping"
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
      }
      renderWorkspaceView()

      expect(capturedWorkerControlBarProps?.isStoppingAfterCurrent).toBe(true)
    })

    it("passes isConnected to WorkerControlBar", () => {
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
      }
      renderWorkspaceView()

      expect(capturedWorkerControlBarProps?.isConnected).toBe(true)
    })
  })

  describe("WorkerControlBar callbacks", () => {
    beforeEach(() => {
      mockOrchestratorWorkers = {
        Ralph: { workerName: "Ralph", state: "running", currentTaskId: "r-abc123" },
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
})
