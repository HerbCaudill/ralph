import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { RalphRunner } from "../RalphRunner"
import type { ChatEvent, ControlState, SessionIndexEntry } from "@herbcaudill/agent-view"

// Mock agent-view components
vi.mock("@herbcaudill/agent-view", () => ({
  AgentView: ({ events, isStreaming, emptyState, header }: any) => (
    <div data-testid="agent-view">
      {header && <div data-testid="agent-view-header">{header}</div>}
      {events.length === 0 && emptyState ? emptyState : null}
      {events.length > 0 && <div data-testid="events">Events: {events.length}</div>}
      {isStreaming && <div data-testid="streaming">Streaming</div>}
    </div>
  ),
  AgentControls: ({ state, disabled }: any) => (
    <div data-testid="agent-controls" data-state={state} data-disabled={disabled}>
      Controls
    </div>
  ),
  ChatInput: ({ disabled, placeholder }: any) => (
    <input data-testid="chat-input" disabled={disabled} placeholder={placeholder} />
  ),
  SessionPicker: ({ sessions, currentSessionId, disabled, taskId, taskTitle }: any) => (
    <button
      data-testid="session-picker"
      title={sessions?.length > 0 ? "Session history" : "No previous sessions"}
      disabled={disabled || !sessions?.length}
      data-session-count={sessions?.length ?? 0}
      data-current-session={currentSessionId ?? ""}
    >
      {taskId ?
        <>
          <span>{taskId}</span>
          {taskTitle && <span>{taskTitle}</span>}
        </>
      : "Sessions"}
    </button>
  ),
  useTokenUsage: () => ({ input: 1000, output: 500 }),
  useContextWindow: () => ({ used: 50000, max: 200000 }),
  useAdapterInfo: (agentType: string) => {
    if (agentType === "claude") return { version: "1.0.0", model: "claude-sonnet-4-20250514" }
    return { version: undefined, model: undefined }
  },
  useDetectedModel: () => undefined, // Model from events (fallback to adapterModel)
  formatModelName: (modelId: string | undefined) => {
    if (modelId === "claude-sonnet-4-20250514") return "Sonnet 4"
    if (modelId === "claude-opus-4-5-20251101") return "Opus 4.5"
    return modelId
  },
  TokenUsageDisplay: ({ tokenUsage }: any) => (
    <div data-testid="token-usage">
      Tokens: {tokenUsage.input}/{tokenUsage.output}
    </div>
  ),
  ContextWindowProgress: ({ contextWindow }: any) => (
    <div data-testid="context-window">
      Context: {contextWindow.used}/{contextWindow.max}
    </div>
  ),
}))

// Mock UI components
vi.mock("../StatusIndicator", () => ({
  StatusIndicator: ({ controlState, isStoppingAfterCurrent }: any) => (
    <div
      data-testid="status-indicator"
      data-state={controlState}
      data-stopping={isStoppingAfterCurrent}
    >
      Status
    </div>
  ),
}))

vi.mock("../RunDuration", () => ({
  RunDuration: ({ elapsedMs }: any) => (
    <div data-testid="run-duration">Duration: {elapsedMs}ms</div>
  ),
}))

vi.mock("../RepoBranch", () => ({
  RepoBranch: ({ workspaceName, branch }: any) => (
    <div data-testid="repo-branch">
      {workspaceName}/{branch}
    </div>
  ),
}))

vi.mock("../ControlBar", () => ({
  ControlBar: ({ controlState, isConnected, isStoppingAfterCurrent }: any) => (
    <div
      data-testid="control-bar"
      data-state={controlState}
      data-connected={isConnected}
      data-stopping={isStoppingAfterCurrent}
    >
      ControlBar
    </div>
  ),
}))

vi.mock("@/hooks/useSessionTimer", () => ({
  useSessionTimer: () => ({ elapsedMs: 5000 }),
}))

const mockEvents: ChatEvent[] = [{ type: "user", role: "user", content: "Hello" } as ChatEvent]

const defaultProps = {
  events: mockEvents,
  isStreaming: false,
  controlState: "idle" as ControlState,
  connectionStatus: "connected" as const,
  workspaceName: "ralph",
  branch: "main",
  workspacePath: "/Users/test/ralph",
  isStoppingAfterCurrent: false,
  onSendMessage: vi.fn(),
  onPause: vi.fn(),
  onStopAfterCurrent: vi.fn(),
  onCancelStopAfterCurrent: vi.fn(),
  onNewSession: vi.fn(),
  onStart: vi.fn(),
}

describe("RalphRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("header with SessionPicker", () => {
    it("does not show 'Ralph' text in header", () => {
      render(<RalphRunner {...defaultProps} />)
      const header = screen.getByTestId("agent-view-header")
      expect(header).not.toHaveTextContent("Ralph")
    })

    it("shows task ID and title in SessionPicker when provided", () => {
      render(<RalphRunner {...defaultProps} taskId="r-abc123" taskTitle="Fix the login bug" />)
      const sessionPicker = screen.getByTestId("session-picker")
      expect(sessionPicker).toHaveTextContent("r-abc123")
      expect(sessionPicker).toHaveTextContent("Fix the login bug")
    })

    it("shows task ID in SessionPicker without title when title is not available", () => {
      render(<RalphRunner {...defaultProps} taskId="r-abc123" />)
      const sessionPicker = screen.getByTestId("session-picker")
      expect(sessionPicker).toHaveTextContent("r-abc123")
    })

    it("does not show task info in SessionPicker when no task is running", () => {
      render(<RalphRunner {...defaultProps} />)
      const sessionPicker = screen.getByTestId("session-picker")
      expect(sessionPicker).toHaveTextContent("Sessions")
      expect(sessionPicker).not.toHaveTextContent("r-")
    })

    it("shows 'Viewing history' badge when isViewingHistoricalSession is true", () => {
      render(<RalphRunner {...defaultProps} isViewingHistoricalSession={true} />)
      expect(screen.getByText("Viewing history")).toBeInTheDocument()
    })

    it("does not show 'Viewing history' badge by default", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.queryByText("Viewing history")).not.toBeInTheDocument()
    })

    it("renders SessionPicker", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("session-picker")).toBeInTheDocument()
    })

    it("passes sessions to SessionPicker", () => {
      const sessions: SessionIndexEntry[] = [
        {
          sessionId: "session-1",
          adapter: "claude",
          firstMessageAt: Date.now() - 3600000,
          lastMessageAt: Date.now() - 3600000,
          firstUserMessage: "Test session 1",
        },
      ]
      render(<RalphRunner {...defaultProps} sessions={sessions} sessionId="session-1" />)
      expect(screen.getByTestId("session-picker")).toHaveAttribute("data-session-count", "1")
      expect(screen.getByTestId("session-picker")).toHaveAttribute(
        "data-current-session",
        "session-1",
      )
    })

    it("enables SessionPicker while streaming so users can switch sessions", () => {
      const sessions: SessionIndexEntry[] = [
        {
          sessionId: "session-1",
          adapter: "claude",
          firstMessageAt: Date.now(),
          lastMessageAt: Date.now(),
          firstUserMessage: "Test session",
        },
      ]
      render(
        <RalphRunner
          {...defaultProps}
          sessions={sessions}
          sessionId="session-1"
          isStreaming={true}
        />,
      )
      expect(screen.getByTestId("session-picker")).not.toBeDisabled()
    })

    it("disables ChatInput when viewing historical session", () => {
      render(
        <RalphRunner {...defaultProps} controlState="running" isViewingHistoricalSession={true} />,
      )
      const input = screen.getByTestId("chat-input")
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute("placeholder", "Switch to current session to send messages")
    })
  })

  describe("footer components", () => {
    it("renders control bar with all actions", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("control-bar")).toBeInTheDocument()
    })

    it("renders status indicator", () => {
      render(<RalphRunner {...defaultProps} controlState="running" />)
      expect(screen.getByTestId("status-indicator")).toBeInTheDocument()
      expect(screen.getByTestId("status-indicator")).toHaveAttribute("data-state", "running")
    })

    it("renders run duration", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("run-duration")).toBeInTheDocument()
    })

    it("renders repo branch info", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("repo-branch")).toBeInTheDocument()
      expect(screen.getByTestId("repo-branch")).toHaveTextContent("ralph/main")
    })

    it("renders token usage display", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("token-usage")).toBeInTheDocument()
    })

    it("renders context window progress", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("context-window")).toBeInTheDocument()
    })

    it("hides repo branch when not provided", () => {
      render(<RalphRunner {...defaultProps} workspaceName={null} branch={null} />)
      expect(screen.queryByTestId("repo-branch")).not.toBeInTheDocument()
    })

    it("passes connection status to control bar", () => {
      render(<RalphRunner {...defaultProps} connectionStatus="disconnected" />)
      expect(screen.getByTestId("control-bar")).toHaveAttribute("data-connected", "false")
    })

    it("passes stopping after current state to components", () => {
      render(<RalphRunner {...defaultProps} isStoppingAfterCurrent={true} />)
      expect(screen.getByTestId("control-bar")).toHaveAttribute("data-stopping", "true")
      expect(screen.getByTestId("status-indicator")).toHaveAttribute("data-stopping", "true")
    })

    it("displays agent adapter name and formatted model in footer", () => {
      render(<RalphRunner {...defaultProps} />)
      const agentInfo = screen.getByTestId("agent-info")
      expect(agentInfo).toHaveTextContent("Claude (Sonnet 4)")
    })

    it("displays agent adapter name without model when model is unavailable", () => {
      render(<RalphRunner {...defaultProps} agentType="codex" />)
      const agentInfo = screen.getByTestId("agent-info")
      expect(agentInfo).toHaveTextContent("Codex")
      expect(agentInfo).not.toHaveTextContent("(")
    })

    it("defaults agentType to claude", () => {
      render(<RalphRunner {...defaultProps} />)
      const agentInfo = screen.getByTestId("agent-info")
      expect(agentInfo).toHaveTextContent("Claude")
    })
  })

  describe("idle state with start button", () => {
    it("shows idle state heading when idle and no events", () => {
      render(<RalphRunner {...defaultProps} events={[]} controlState="idle" />)
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
    })

    it("shows idle state subtext when idle and no events", () => {
      render(<RalphRunner {...defaultProps} events={[]} controlState="idle" />)
      expect(screen.getByText("Click Start to begin working on open tasks")).toBeInTheDocument()
    })

    it("shows idle state with start button when idle and no events", () => {
      render(<RalphRunner {...defaultProps} events={[]} controlState="idle" />)
      const startButton = screen.getByRole("button", { name: /start ralph/i })
      expect(startButton).toBeInTheDocument()
    })

    it("calls onStart when start button in idle state is clicked", () => {
      render(
        <RalphRunner
          {...defaultProps}
          events={[]}
          controlState="idle"
          connectionStatus="connected"
        />,
      )
      const startButton = screen.getByRole("button", { name: /start ralph/i })
      fireEvent.click(startButton)
      expect(defaultProps.onStart).toHaveBeenCalled()
    })

    it("disables start button in idle state when disconnected", () => {
      render(
        <RalphRunner
          {...defaultProps}
          events={[]}
          controlState="idle"
          connectionStatus="disconnected"
        />,
      )
      const startButton = screen.getByRole("button", { name: /start ralph/i })
      expect(startButton).toBeDisabled()
    })

    it("does not show idle state when running", () => {
      render(<RalphRunner {...defaultProps} events={[]} controlState="running" />)
      expect(screen.queryByRole("button", { name: /start ralph/i })).not.toBeInTheDocument()
    })

    it("does not show idle state when there are events", () => {
      render(<RalphRunner {...defaultProps} controlState="idle" />)
      expect(screen.queryByRole("button", { name: /start ralph/i })).not.toBeInTheDocument()
    })
  })

  describe("main content", () => {
    it("renders agent view with events", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("agent-view")).toBeInTheDocument()
      expect(screen.getByTestId("events")).toBeInTheDocument()
    })

    it("hides chat input when controlState is idle", () => {
      render(<RalphRunner {...defaultProps} controlState="idle" />)
      expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument()
    })

    it("shows chat input when controlState is running", () => {
      render(<RalphRunner {...defaultProps} controlState="running" />)
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    })

    it("shows chat input when controlState is paused", () => {
      render(<RalphRunner {...defaultProps} controlState="paused" />)
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    })

    it("enables chat input even when streaming", () => {
      render(<RalphRunner {...defaultProps} controlState="running" isStreaming={true} />)
      expect(screen.getByTestId("chat-input")).not.toBeDisabled()
    })

    it("enables chat input when session is active regardless of streaming state", () => {
      const { rerender } = render(
        <RalphRunner {...defaultProps} controlState="running" isStreaming={false} />,
      )
      expect(screen.getByTestId("chat-input")).not.toBeDisabled()

      rerender(<RalphRunner {...defaultProps} controlState="running" isStreaming={true} />)
      expect(screen.getByTestId("chat-input")).not.toBeDisabled()

      rerender(<RalphRunner {...defaultProps} controlState="paused" isStreaming={false} />)
      expect(screen.getByTestId("chat-input")).not.toBeDisabled()
    })
  })
})
