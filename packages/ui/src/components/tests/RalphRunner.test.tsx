import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { RalphRunner } from "../RalphRunner"
import type { ChatEvent, ControlState } from "@herbcaudill/agent-view"

// Mock agent-view components
vi.mock("@herbcaudill/agent-view", () => ({
  AgentView: ({ events, isStreaming }: any) => (
    <div data-testid="agent-view">
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
  useTokenUsage: () => ({ input: 1000, output: 500 }),
  useContextWindow: () => ({ used: 50000, max: 200000 }),
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
  onSendMessage: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onStop: vi.fn(),
  onNewSession: vi.fn(),
  onStart: vi.fn(),
  onStopAfterCurrent: vi.fn(),
  onCancelStopAfterCurrent: vi.fn(),
}

describe("RalphRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })

  describe("main content", () => {
    it("renders agent view with events", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("agent-view")).toBeInTheDocument()
      expect(screen.getByTestId("events")).toBeInTheDocument()
    })

    it("renders chat input", () => {
      render(<RalphRunner {...defaultProps} />)
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    })

    it("disables chat input when streaming", () => {
      render(<RalphRunner {...defaultProps} isStreaming={true} />)
      expect(screen.getByTestId("chat-input")).toBeDisabled()
    })
  })
})
