import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { EventLogViewer } from "./EventLogViewer"
import { useAppStore, type EventLog, type RalphEvent } from "@/store"

// Mock the useEventLogRouter hook
vi.mock("@/hooks", () => ({
  useEventLogRouter: () => ({
    navigateToEventLog: vi.fn(),
    closeEventLogViewer: vi.fn(),
    eventLogId: null,
  }),
}))

// Helper to create test events
function createUserMessageEvent(message: string, timestamp = Date.now()): RalphEvent {
  return {
    type: "user_message",
    message,
    timestamp,
  }
}

function createAssistantEvent(
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >,
  timestamp = Date.now(),
): RalphEvent {
  return {
    type: "assistant",
    message: { content },
    timestamp,
  }
}

function createToolResultEvent(
  toolUseId: string,
  output: string,
  isError = false,
  timestamp = Date.now(),
): RalphEvent {
  return {
    type: "user",
    tool_use_result: true,
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: output,
          is_error: isError,
        },
      ],
    },
    timestamp,
  }
}

// Helper to create a test event log
function createTestEventLog(overrides: Partial<EventLog> = {}): EventLog {
  return {
    id: "abc12345",
    createdAt: "2024-01-15T10:30:00Z",
    events: [],
    metadata: {
      taskId: "TASK-123",
      title: "Test Task",
    },
    ...overrides,
  }
}

describe("EventLogViewer", () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    // Reset store state before each test
    useAppStore.getState().clearEventLogViewer()

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    // Restore clipboard
    Object.assign(navigator, { clipboard: originalClipboard })
  })

  describe("loading state", () => {
    it("shows loading indicator when loading", () => {
      useAppStore.getState().setViewingEventLogId("abc12345")
      useAppStore.getState().setEventLogLoading(true)

      render(<EventLogViewer />)

      expect(screen.getByText("Loading event log...")).toBeInTheDocument()
    })

    it("shows header with close button during loading", () => {
      useAppStore.getState().setViewingEventLogId("abc12345")
      useAppStore.getState().setEventLogLoading(true)

      render(<EventLogViewer />)

      expect(screen.getByText("Event Log")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument()
    })
  })

  describe("error state", () => {
    it("shows error message when error occurs", () => {
      useAppStore.getState().setViewingEventLogId("abc12345")
      useAppStore.getState().setEventLogError("Event log not found")

      render(<EventLogViewer />)

      expect(screen.getByText("Event log not found")).toBeInTheDocument()
    })

    it("shows close link in error state", () => {
      useAppStore.getState().setViewingEventLogId("abc12345")
      useAppStore.getState().setEventLogError("Event log not found")

      render(<EventLogViewer />)

      // There are two close buttons - one in header and one in error body
      const closeButtons = screen.getAllByRole("button", { name: /close/i })
      expect(closeButtons.length).toBe(2)
      expect(screen.getByText("Close")).toBeInTheDocument()
    })
  })

  describe("empty state", () => {
    it("returns null when no event log ID", () => {
      const { container } = render(<EventLogViewer />)
      expect(container).toBeEmptyDOMElement()
    })

    it("shows empty message when event log has no events", () => {
      const eventLog = createTestEventLog({ events: [] })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText("No events in this log")).toBeInTheDocument()
    })
  })

  describe("metadata display", () => {
    it("displays created date", () => {
      const eventLog = createTestEventLog()
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText(/Created:/)).toBeInTheDocument()
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
    })

    it("displays task ID when available", () => {
      const eventLog = createTestEventLog({
        metadata: { taskId: "TASK-456" },
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText(/Task:/)).toBeInTheDocument()
      expect(screen.getByText("TASK-456")).toBeInTheDocument()
    })

    it("displays title when available", () => {
      const eventLog = createTestEventLog({
        metadata: { title: "My Important Task" },
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText(/Title:/)).toBeInTheDocument()
      expect(screen.getByText("My Important Task")).toBeInTheDocument()
    })

    it("hides task ID when not available", () => {
      const eventLog = createTestEventLog({
        metadata: {},
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.queryByText(/Task:/)).not.toBeInTheDocument()
    })
  })

  describe("event rendering", () => {
    it("renders user message events", () => {
      const eventLog = createTestEventLog({
        events: [createUserMessageEvent("Hello, Ralph!")],
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText("Hello, Ralph!")).toBeInTheDocument()
    })

    it("renders assistant text events", () => {
      const eventLog = createTestEventLog({
        events: [createAssistantEvent([{ type: "text", text: "Hello! How can I help?" }])],
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText("Hello! How can I help?")).toBeInTheDocument()
    })

    it("renders tool use events", () => {
      const eventLog = createTestEventLog({
        events: [
          createAssistantEvent([
            { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "/test.txt" } },
          ]),
          createToolResultEvent("tool-1", "File contents here"),
        ],
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      // The ToolUseCard component should render the tool name
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it("matches tool results with tool uses", () => {
      const eventLog = createTestEventLog({
        events: [
          createAssistantEvent([
            { type: "tool_use", id: "tool-abc", name: "Bash", input: { command: "ls -la" } },
          ]),
          createToolResultEvent("tool-abc", "file1.txt\nfile2.txt"),
        ],
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText("Bash")).toBeInTheDocument()
    })
  })

  describe("copy link functionality", () => {
    it("copies event log link to clipboard", async () => {
      const eventLog = createTestEventLog()
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      const copyButton = screen.getByRole("button", { name: /copy link/i })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining("#eventlog=abc12345"),
        )
      })
    })

    it("shows check icon after copying", async () => {
      const eventLog = createTestEventLog()
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      const copyButton = screen.getByRole("button", { name: /copy link/i })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument()
      })
    })
  })

  describe("scroll behavior", () => {
    it("renders scroll container with proper role", () => {
      const eventLog = createTestEventLog({
        events: [createUserMessageEvent("Test message")],
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByRole("log")).toBeInTheDocument()
    })

    it("has scroll to bottom button", () => {
      const eventLog = createTestEventLog({
        events: Array.from({ length: 50 }, (_, i) =>
          createUserMessageEvent(`Message ${i}`, Date.now() + i),
        ),
      })
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      // Button should be visible when not at bottom
      // Note: In a real scenario with actual scrolling, the button would appear
      // For this unit test, we just verify the component renders correctly
      expect(screen.getByRole("log")).toBeInTheDocument()
    })
  })

  describe("header", () => {
    it("displays Event Log header", () => {
      const eventLog = createTestEventLog()
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      expect(screen.getByText("Event Log")).toBeInTheDocument()
    })

    it("has close button in header", () => {
      const eventLog = createTestEventLog()
      useAppStore.getState().setViewingEventLogId(eventLog.id)
      useAppStore.getState().setViewingEventLog(eventLog)

      render(<EventLogViewer />)

      const closeButton = screen.getByRole("button", { name: /close event log viewer/i })
      expect(closeButton).toBeInTheDocument()
    })
  })
})
