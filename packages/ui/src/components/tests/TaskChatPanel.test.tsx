import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskChatPanel } from "../TaskChatPanel"
import type { ChatEvent, SessionIndexEntry } from "@herbcaudill/agent-view"

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
      {/* Footer slot content - if it exists */}
      {footer && <div data-testid="agent-view-footer">{footer}</div>}
    </div>
  ),
  AgentViewProvider: ({ children }: any) => <div data-testid="agent-view-provider">{children}</div>,
  SessionPicker: ({ sessions, currentSessionId, onSelectSession, disabled }: any) => (
    <div data-testid="session-picker" data-disabled={disabled}>
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
  listSessions: () => [],
}))

const mockEvents: ChatEvent[] = [{ type: "user", role: "user", content: "Hello" } as ChatEvent]

const defaultProps = {
  taskId: "task-1",
  taskTitle: "Test Task",
  events: mockEvents,
  isStreaming: false,
  sessionId: "session-1",
  onSendMessage: vi.fn(),
  onSessionSelect: vi.fn(),
  onNewSession: vi.fn(),
  onClose: vi.fn(),
}

describe("TaskChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("footer", () => {
    it("does not render content in AgentView footer slot", () => {
      render(<TaskChatPanel {...defaultProps} />)

      // The agent-view-footer test id should not exist because we pass no footer prop
      expect(screen.queryByTestId("agent-view-footer")).not.toBeInTheDocument()
    })

    it("still renders ChatInput outside of AgentView", () => {
      render(<TaskChatPanel {...defaultProps} />)

      // ChatInput should still exist, just not inside the AgentView footer slot
      expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    })
  })

  describe("header", () => {
    it("renders header with task title", () => {
      render(<TaskChatPanel {...defaultProps} />)

      expect(screen.getByText("Task chat")).toBeInTheDocument()
      expect(screen.getByText("Test Task")).toBeInTheDocument()
    })

    it("renders close button when taskId is provided", () => {
      render(<TaskChatPanel {...defaultProps} />)

      const closeButton = screen.getByLabelText("Close chat panel")
      expect(closeButton).toBeInTheDocument()
    })

    it("calls onClose when close button is clicked", () => {
      render(<TaskChatPanel {...defaultProps} />)

      const closeButton = screen.getByLabelText("Close chat panel")
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    it("renders new session button", () => {
      render(<TaskChatPanel {...defaultProps} />)

      const newSessionButton = screen.getByLabelText("New session")
      expect(newSessionButton).toBeInTheDocument()
    })

    it("calls onNewSession when new session button is clicked", () => {
      render(<TaskChatPanel {...defaultProps} />)

      const newSessionButton = screen.getByLabelText("New session")
      fireEvent.click(newSessionButton)

      expect(defaultProps.onNewSession).toHaveBeenCalledTimes(1)
    })

    it("disables new session button when streaming", () => {
      render(<TaskChatPanel {...defaultProps} isStreaming={true} />)

      const newSessionButton = screen.getByLabelText("New session")
      expect(newSessionButton).toBeDisabled()
    })
  })

  describe("empty state", () => {
    it("renders empty state when no events", () => {
      render(<TaskChatPanel {...defaultProps} events={[]} />)

      expect(screen.getByText("Start a conversation about this task.")).toBeInTheDocument()
    })
  })

  describe("chat input", () => {
    it("disables chat input when streaming", () => {
      render(<TaskChatPanel {...defaultProps} isStreaming={true} />)

      const input = screen.getByTestId("chat-input-field")
      expect(input).toBeDisabled()
    })

    it("enables chat input when not streaming", () => {
      render(<TaskChatPanel {...defaultProps} isStreaming={false} />)

      const input = screen.getByTestId("chat-input-field")
      expect(input).not.toBeDisabled()
    })
  })
})
