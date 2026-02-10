import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TaskChatPanel } from "../TaskChatPanel"
import type { ChatEvent, SessionIndexEntry } from "@herbcaudill/agent-view"

// Mock Button component from @herbcaudill/components
vi.mock("@herbcaudill/components", () => ({
  Button: ({ children, variant, onClick, disabled, "aria-label": ariaLabel, ...props }: any) => (
    <button
      data-testid="button-component"
      data-variant={variant || "default"}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
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

    it("renders new chat button with text", () => {
      render(<TaskChatPanel {...defaultProps} />)

      const newChatButton = screen.getByLabelText("New chat")
      expect(newChatButton).toBeInTheDocument()
      expect(screen.getByText("New chat")).toBeInTheDocument()
    })

    it("calls onNewSession when new chat button is clicked", () => {
      render(<TaskChatPanel {...defaultProps} />)

      const newChatButton = screen.getByLabelText("New chat")
      fireEvent.click(newChatButton)

      expect(defaultProps.onNewSession).toHaveBeenCalledTimes(1)
    })

    it("disables new chat button when streaming", () => {
      render(<TaskChatPanel {...defaultProps} isStreaming={true} />)

      const newChatButton = screen.getByLabelText("New chat")
      expect(newChatButton).toBeDisabled()
    })

    it("renders new chat button using Button component with default variant", () => {
      render(<TaskChatPanel {...defaultProps} />)

      const newChatButton = screen.getByLabelText("New chat")
      // The Button component mock sets data-variant to "default" when no variant is specified
      expect(newChatButton).toHaveAttribute("data-variant", "default")
      expect(newChatButton).toHaveAttribute("data-testid", "button-component")
    })
  })

  describe("empty state", () => {
    it("renders empty state when no events", () => {
      render(<TaskChatPanel {...defaultProps} events={[]} />)

      expect(screen.getByText("Start a conversation about this task.")).toBeInTheDocument()
    })
  })

  describe("chat input", () => {
    it("keeps chat input enabled while streaming so user can type next message", () => {
      render(<TaskChatPanel {...defaultProps} isStreaming={true} />)

      const input = screen.getByTestId("chat-input-field")
      expect(input).not.toBeDisabled()
    })

    it("keeps chat input enabled when not streaming", () => {
      render(<TaskChatPanel {...defaultProps} isStreaming={false} />)

      const input = screen.getByTestId("chat-input-field")
      expect(input).not.toBeDisabled()
    })
  })

  describe("layout", () => {
    it("renders chat input in a non-shrinkable container at the bottom", () => {
      render(<TaskChatPanel {...defaultProps} />)

      // Find the chat input wrapper (parent of chat-input)
      const chatInput = screen.getByTestId("chat-input")
      const chatInputWrapper = chatInput.parentElement

      // The wrapper should have shrink-0 to prevent it from being hidden by overflow
      expect(chatInputWrapper).toHaveClass("shrink-0")
    })

    it("renders with overflow-hidden on the outer container", () => {
      const { container } = render(<TaskChatPanel {...defaultProps} />)

      // The outer container should have overflow-hidden
      const outerContainer = container.firstChild
      expect(outerContainer).toHaveClass("overflow-hidden")
    })
  })
})
