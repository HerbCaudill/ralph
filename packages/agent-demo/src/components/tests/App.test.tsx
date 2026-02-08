import { render, screen, cleanup } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { App } from "../../App"

// Mock workspace state, customizable per test
let mockWorkspaceState = {
  current: { path: "/test/repo", name: "Test Repo", accentColor: undefined as string | undefined },
  workspaces: [
    { path: "/test/repo", name: "Test Repo" },
    { path: "/other/repo", name: "Other Repo" },
  ],
  isLoading: false,
  error: null,
}

const mockSwitchWorkspace = vi.fn()

// Mock beads-view (useWorkspace, WorkspaceSelector, configureApiClient)
vi.mock("@herbcaudill/beads-view", () => ({
  useWorkspace: () => ({
    state: mockWorkspaceState,
    actions: { switchWorkspace: mockSwitchWorkspace },
  }),
  WorkspaceSelector: ({
    current,
    workspaces,
    onSwitch,
  }: {
    current: { name: string } | null
    workspaces: { path: string; name: string }[]
    isLoading: boolean
    onSwitch: (path: string) => void
  }) => (
    <div data-testid="workspace-selector">
      <span>{current?.name ?? "No workspace"}</span>
      {workspaces.map(ws => (
        <button key={ws.path} onClick={() => onSwitch(ws.path)}>
          {ws.name}
        </button>
      ))}
    </div>
  ),
  configureApiClient: vi.fn(),
}))

// Mock agent-view hooks so they don't try real WebSocket connections
vi.mock("@herbcaudill/agent-view", () => ({
  useAgentChat: () => ({
    state: {
      events: [],
      isStreaming: false,
      connectionStatus: "connected",
      error: null,
      sessionId: null,
    },
    actions: {
      sendMessage: vi.fn(),
      setAgentType: vi.fn(),
      newSession: vi.fn(),
      restoreSession: vi.fn(),
    },
    agentType: "claude",
  }),
  useAgentControl: () => ({
    state: "idle",
  }),
  useAgentHotkeys: () => ({
    registeredHotkeys: [],
  }),
  useAdapterInfo: () => ({
    version: "1.0.0",
    model: "claude-sonnet-4-20250514",
  }),
  formatModelName: (model: string | undefined) => model ?? "Unknown",
  listSessions: () => [],
  AgentView: () => <div data-testid="agent-view" />,
  AgentControls: () => <div data-testid="agent-controls" />,
  SessionPicker: () => <div data-testid="session-picker" />,
  ChatInput: () => <div data-testid="chat-input" />,
  useTokenUsage: () => ({ input: 0, output: 0 }),
  useContextWindow: () => ({ used: 0, max: 200_000 }),
  TokenUsageDisplay: () => null,
  ContextWindowProgress: () => null,
}))

describe("App", () => {
  beforeEach(() => {
    mockWorkspaceState = {
      current: {
        path: "/test/repo",
        name: "Test Repo",
        accentColor: undefined,
      },
      workspaces: [
        { path: "/test/repo", name: "Test Repo" },
        { path: "/other/repo", name: "Other Repo" },
      ],
      isLoading: false,
      error: null,
    }
    mockSwitchWorkspace.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the workspace selector in the header", () => {
    render(<App />)
    expect(screen.getByTestId("workspace-selector")).toBeInTheDocument()
  })

  it("displays the current workspace name", () => {
    render(<App />)
    const selector = screen.getByTestId("workspace-selector")
    const nameSpan = selector.querySelector("span")
    expect(nameSpan).toHaveTextContent("Test Repo")
  })

  it("shows available workspaces", () => {
    render(<App />)
    expect(screen.getByText("Other Repo")).toBeInTheDocument()
  })

  it("calls switchWorkspace when a workspace is selected", async () => {
    render(<App />)
    const otherButton = screen.getByRole("button", { name: "Other Repo" })
    otherButton.click()
    expect(mockSwitchWorkspace).toHaveBeenCalledWith("/other/repo")
  })

  it("shows 'No workspace' when current workspace is null", () => {
    mockWorkspaceState.current = null as any
    render(<App />)
    expect(screen.getByText("No workspace")).toBeInTheDocument()
  })
})
