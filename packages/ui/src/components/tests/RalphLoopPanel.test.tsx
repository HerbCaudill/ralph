import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { RalphLoopPanel } from "../RalphLoopPanel"
import type {
  ChatEvent,
  SessionIndexEntry,
  ConnectionStatus,
  ControlState,
} from "@herbcaudill/agent-view"

// Mock TopologySpinner (local component)
vi.mock("../TopologySpinner", () => ({
  TopologySpinner: () => <div data-testid="topology-spinner" />,
}))

// Mock agent-view components
vi.mock("@herbcaudill/agent-view", () => ({
  AgentView: ({ events, isStreaming, header, footer, emptyState }: any) => (
    <div data-testid="agent-view">
      {header}
      <div data-testid="events-container">
        {events.length === 0 ?
          emptyState
        : events.map((e: ChatEvent, i: number) => (
            <div key={i} data-testid={`event-${i}`}>
              {e.type}
            </div>
          ))
        }
      </div>
      {isStreaming && <div data-testid="streaming-indicator">Streaming...</div>}
      {footer}
    </div>
  ),
  AgentViewProvider: ({ children }: any) => <div data-testid="agent-view-provider">{children}</div>,
  AgentControls: ({
    state,
    onPause,
    onResume,
    onStop,
    onNewSession,
    disabled,
    showNewSession = true,
  }: any) => (
    <div data-testid="agent-controls" data-state={state} data-disabled={disabled}>
      <button onClick={onPause} data-testid="pause-btn">
        Pause
      </button>
      <button onClick={onResume} data-testid="resume-btn">
        Resume
      </button>
      <button onClick={onStop} data-testid="stop-btn">
        Stop
      </button>
      {showNewSession && (
        <button onClick={onNewSession} data-testid="new-session-btn">
          New Session
        </button>
      )}
    </div>
  ),
  SessionPicker: ({
    sessions,
    currentSessionId,
    onSelectSession,
    disabled,
    taskId,
    taskTitle,
  }: any) => (
    <div data-testid="session-picker" data-disabled={disabled}>
      {taskId && (
        <div data-testid="session-picker-task-info">
          <span>{taskId}</span>
          {taskTitle && <span>{taskTitle}</span>}
        </div>
      )}
      <select
        value={currentSessionId || ""}
        onChange={e => onSelectSession(e.target.value)}
        data-testid="session-select"
      >
        <option value="">Select session</option>
        {sessions.map((s: SessionIndexEntry) => (
          <option key={s.sessionId} value={s.sessionId}>
            {s.firstUserMessage}
          </option>
        ))}
      </select>
    </div>
  ),
  ChatInput: ({ onSend, disabled, placeholder }: any) => (
    <div data-testid="chat-input">
      <input
        data-testid="chat-input-field"
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) {
            onSend((e.target as HTMLInputElement).value)
          }
        }}
      />
    </div>
  ),
  TokenUsageDisplay: ({ tokenUsage }: any) => (
    <div data-testid="token-usage">
      Input: {tokenUsage.input} Output: {tokenUsage.output}
    </div>
  ),
  ContextWindowProgress: ({ contextWindow }: any) => (
    <div data-testid="context-window">
      {contextWindow.used}/{contextWindow.max}
    </div>
  ),
  useTokenUsage: () => ({ input: 1000, output: 500 }),
  useContextWindow: () => ({ used: 50000, max: 200000 }),
}))

const mockSessions: SessionIndexEntry[] = [
  {
    sessionId: "session-1",
    adapter: "claude",
    firstMessageAt: Date.now() - 3600000, // 1 hour ago
    lastMessageAt: Date.now() - 1800000, // 30 min ago
    firstUserMessage: "First session message",
    hasResponse: true,
  },
  {
    sessionId: "session-2",
    adapter: "claude",
    firstMessageAt: Date.now() - 7200000, // 2 hours ago
    lastMessageAt: Date.now() - 3600000, // 1 hour ago
    firstUserMessage: "Second session message",
    hasResponse: true,
  },
]

const mockEvents: ChatEvent[] = [
  { type: "user", role: "user", content: "Hello" } as ChatEvent,
  {
    type: "assistant",
    role: "assistant",
    content: [{ type: "text", text: "Hi there!" }],
  } as ChatEvent,
]

const defaultProps = {
  events: mockEvents,
  isStreaming: false,
  controlState: "idle" as ControlState,
  connectionStatus: "connected" as ConnectionStatus,
  sessionId: "session-1",
  sessions: mockSessions,
  error: null,
  onSendMessage: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onStop: vi.fn(),
  onStart: vi.fn(),
  onNewSession: vi.fn(),
  onSelectSession: vi.fn(),
}

describe("RalphLoopPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("header", () => {
    it("renders session picker in header", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      expect(screen.getByTestId("session-picker")).toBeInTheDocument()
    })

    it("passes sessions to session picker", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      const select = screen.getByTestId("session-select")
      expect(select.querySelectorAll("option")).toHaveLength(3) // 2 sessions + empty option
    })

    it("passes current session id to session picker", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      const select = screen.getByTestId("session-select") as HTMLSelectElement
      expect(select.value).toBe("session-1")
    })

    it("calls onSelectSession when session is selected", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      const select = screen.getByTestId("session-select")
      fireEvent.change(select, { target: { value: "session-2" } })
      expect(defaultProps.onSelectSession).toHaveBeenCalledWith("session-2")
    })

    it("disables session picker when streaming", () => {
      render(<RalphLoopPanel {...defaultProps} isStreaming={true} />)
      expect(screen.getByTestId("session-picker")).toHaveAttribute("data-disabled", "true")
    })

    it("does not show 'Ralph Loop' text in header", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      // The header should no longer show "Ralph Loop" text, just the robot icon
      expect(screen.queryByText("Ralph Loop")).not.toBeInTheDocument()
    })

    it("shows task ID and title in SessionPicker when provided", () => {
      render(<RalphLoopPanel {...defaultProps} taskId="r-abc123" taskTitle="Fix login bug" />)
      const taskInfo = screen.getByTestId("session-picker-task-info")
      expect(taskInfo).toHaveTextContent("r-abc123")
      expect(taskInfo).toHaveTextContent("Fix login bug")
    })

    it("does not show task info in SessionPicker when no task", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      expect(screen.queryByTestId("session-picker-task-info")).not.toBeInTheDocument()
    })
  })

  describe("main body", () => {
    it("renders AgentView with events", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      expect(screen.getByTestId("agent-view")).toBeInTheDocument()
      expect(screen.getByTestId("event-0")).toBeInTheDocument()
      expect(screen.getByTestId("event-1")).toBeInTheDocument()
    })

    it("shows streaming indicator when streaming", () => {
      render(<RalphLoopPanel {...defaultProps} isStreaming={true} />)
      expect(screen.getByTestId("streaming-indicator")).toBeInTheDocument()
    })

    it("shows empty state with correct heading when no events", () => {
      render(<RalphLoopPanel {...defaultProps} events={[]} />)
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
    })

    it("shows empty state with correct subtext when no events", () => {
      render(<RalphLoopPanel {...defaultProps} events={[]} />)
      expect(screen.getByText("Click Start to begin working on open tasks")).toBeInTheDocument()
    })
  })

  describe("chat input", () => {
    it("shows chat input when session is running", () => {
      render(<RalphLoopPanel {...defaultProps} controlState="running" />)
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    })

    it("shows chat input when session is paused", () => {
      render(<RalphLoopPanel {...defaultProps} controlState="paused" />)
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    })

    it("hides chat input when session is idle (no active session)", () => {
      render(<RalphLoopPanel {...defaultProps} controlState="idle" />)
      expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument()
    })

    it("enables chat input when viewing current session and not streaming", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          controlState="running"
          isViewingHistoricalSession={false}
        />,
      )
      const input = screen.getByTestId("chat-input-field")
      expect(input).not.toBeDisabled()
    })

    it("hides chat input when viewing historical session", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          controlState="running"
          isViewingHistoricalSession={true}
        />,
      )
      expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument()
      expect(screen.queryByTestId("chat-input-field")).not.toBeInTheDocument()
    })

    it("enables chat input even when streaming", () => {
      render(<RalphLoopPanel {...defaultProps} controlState="running" isStreaming={true} />)
      const input = screen.getByTestId("chat-input-field")
      expect(input).not.toBeDisabled()
    })

    it("calls onSendMessage when enter is pressed", () => {
      render(<RalphLoopPanel {...defaultProps} controlState="running" />)
      const input = screen.getByTestId("chat-input-field")
      fireEvent.change(input, { target: { value: "test message" } })
      fireEvent.keyDown(input, { key: "Enter" })
      expect(defaultProps.onSendMessage).toHaveBeenCalledWith("test message")
    })
  })

  describe("agent controls", () => {
    it("does not render agent controls (control bar has been removed)", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      expect(screen.queryByTestId("agent-controls")).not.toBeInTheDocument()
    })
  })

  describe("status bar footer", () => {
    it("renders connection status indicator", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      expect(screen.getByText("connected")).toBeInTheDocument()
    })

    it("renders connecting status", () => {
      render(<RalphLoopPanel {...defaultProps} connectionStatus="connecting" />)
      expect(screen.getByText("connecting")).toBeInTheDocument()
    })

    it("renders disconnected status", () => {
      render(<RalphLoopPanel {...defaultProps} connectionStatus="disconnected" />)
      expect(screen.getByText("disconnected")).toBeInTheDocument()
    })

    it("renders token usage display", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      expect(screen.getByTestId("token-usage")).toBeInTheDocument()
    })

    it("renders context window progress", () => {
      render(<RalphLoopPanel {...defaultProps} />)
      expect(screen.getByTestId("context-window")).toBeInTheDocument()
    })

    it("renders error when present", () => {
      render(<RalphLoopPanel {...defaultProps} error="Connection failed" />)
      expect(screen.getByText("Connection failed")).toBeInTheDocument()
    })
  })

  describe("historical session viewing", () => {
    it("hides chat input when viewing historical session", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          controlState="running"
          isViewingHistoricalSession={true}
        />,
      )
      expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument()
    })

    it("shows chat input when not viewing historical session", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          controlState="running"
          isViewingHistoricalSession={false}
        />,
      )
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    })
  })

  describe("idle state when no Ralph process is running", () => {
    it("shows empty state when connecting with no events", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          events={[]}
          controlState="idle"
          connectionStatus="connecting"
        />,
      )
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
    })

    it("does not show loading indicator when connecting with no events", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          events={[]}
          controlState="idle"
          connectionStatus="connecting"
        />,
      )
      expect(screen.queryByText("Connecting...")).not.toBeInTheDocument()
    })

    it("shows empty state once connected with no events", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          events={[]}
          controlState="idle"
          connectionStatus="connected"
        />,
      )
      // Only show empty state once we're connected and confirmed idle
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
    })

    it("does not show loading state when disconnected with no events", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          events={[]}
          controlState="idle"
          connectionStatus="disconnected"
        />,
      )
      // Disconnected is a terminal state, show the empty state (with disabled button)
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
      expect(screen.queryByText("Connecting...")).not.toBeInTheDocument()
    })
  })

  describe("start button", () => {
    it("shows centered start button when idle with no events", () => {
      render(<RalphLoopPanel {...defaultProps} events={[]} controlState="idle" />)
      expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument()
    })

    it("uses accent styling for the start button", () => {
      render(<RalphLoopPanel {...defaultProps} events={[]} controlState="idle" />)
      const startButton = screen.getByRole("button", { name: /start/i })
      expect(startButton).toHaveClass("bg-accent", "hover:bg-accent/90")
      expect(startButton).not.toHaveClass("bg-green-600", "hover:bg-green-700")
    })

    it("calls onStart when start button is clicked", () => {
      render(<RalphLoopPanel {...defaultProps} events={[]} controlState="idle" />)
      fireEvent.click(screen.getByRole("button", { name: /start/i }))
      expect(defaultProps.onStart).toHaveBeenCalled()
    })

    it("does not show start button when running", () => {
      render(<RalphLoopPanel {...defaultProps} events={[]} controlState="running" />)
      expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument()
    })

    it("does not show start button when paused", () => {
      render(<RalphLoopPanel {...defaultProps} events={[]} controlState="paused" />)
      expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument()
    })

    it("does not show start button when there are events", () => {
      render(<RalphLoopPanel {...defaultProps} controlState="idle" />)
      expect(screen.queryByRole("button", { name: /start/i })).not.toBeInTheDocument()
    })

    it("disables start button when disconnected", () => {
      render(
        <RalphLoopPanel
          {...defaultProps}
          events={[]}
          controlState="idle"
          connectionStatus="disconnected"
        />,
      )
      expect(screen.getByRole("button", { name: /start/i })).toBeDisabled()
    })
  })
})
