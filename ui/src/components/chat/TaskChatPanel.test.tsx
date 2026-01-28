import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TaskChatPanel } from "./TaskChatPanel"
import { useAppStore, flushTaskChatEventsBatch } from "@/store"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

/**
 * Helper to add an assistant message via SDK events (the new unified model).
 * This simulates what happens when the server sends assistant content through WebSocket.
 * Flushes the batch immediately so events are available synchronously in tests.
 */
function addAssistantEvent(content: string, timestamp: number) {
  useAppStore.getState().addTaskChatEvent({
    type: "assistant",
    timestamp,
    message: {
      content: [{ type: "text", text: content }],
    },
  } as any)
  // Flush the batch immediately so events are applied synchronously in tests
  flushTaskChatEventsBatch()
}

describe("TaskChatPanel", () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppStore.getState().clearTaskChatMessages()
    useAppStore.getState().clearTaskChatEvents()
    useAppStore.getState().setTaskChatLoading(false)
    useAppStore.getState().setConnectionStatus("connected")
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("rendering", () => {
    it("renders header with title", () => {
      render(<TaskChatPanel />)
      expect(screen.getByText("Task Chat")).toBeInTheDocument()
    })

    it("renders empty state when no messages", () => {
      render(<TaskChatPanel />)
      expect(screen.getByText("Manage your tasks")).toBeInTheDocument()
    })

    it("renders chat input", () => {
      render(<TaskChatPanel />)
      expect(screen.getByRole("textbox")).toBeInTheDocument()
    })

    it("renders close button when onClose is provided", () => {
      render(<TaskChatPanel onClose={() => {}} />)
      expect(screen.getByRole("button", { name: "Close task chat" })).toBeInTheDocument()
    })

    it("does not render close button when onClose is not provided", () => {
      render(<TaskChatPanel />)
      expect(screen.queryByRole("button", { name: "Close task chat" })).not.toBeInTheDocument()
    })

    it("renders clear history button", () => {
      render(<TaskChatPanel />)
      expect(screen.getByRole("button", { name: "Clear chat history" })).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(<TaskChatPanel className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("message display", () => {
    it("renders user messages", () => {
      // Add a user message to the store
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello, how do I prioritize tasks?",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.getByText("Hello, how do I prioritize tasks?")).toBeInTheDocument()
    })

    it("renders assistant messages with markdown", () => {
      // Add an assistant message via SDK events (the new unified model)
      addAssistantEvent("You can **prioritize** tasks by setting their priority level.", Date.now())

      render(<TaskChatPanel />)
      expect(screen.getByText(/prioritize/)).toBeInTheDocument()
    })

    it("renders multiple messages in order", () => {
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "First message",
        timestamp: 1,
      })
      // Assistant message via SDK events
      addAssistantEvent("Second message", 2)
      useAppStore.getState().addTaskChatMessage({
        id: "user-2",
        role: "user",
        content: "Third message",
        timestamp: 3,
      })

      render(<TaskChatPanel />)

      const messages = screen.getAllByText(/message/)
      expect(messages).toHaveLength(3)
    })

    it("hides empty state when messages exist", () => {
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.queryByText("Manage your tasks")).not.toBeInTheDocument()
    })
  })

  describe("loading state", () => {
    it("shows loading indicator when loading", () => {
      useAppStore.getState().setTaskChatLoading(true)
      // Add a message so we're not in empty state
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.getByTestId("task-chat-loading-spinner")).toBeInTheDocument()
    })

    it("shows idle spinner when not loading and has content", () => {
      useAppStore.getState().setTaskChatLoading(false)
      // Add a message so we have content
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.getByTestId("task-chat-idle-spinner")).toBeInTheDocument()
      expect(screen.getByLabelText("Task chat is idle")).toBeInTheDocument()
    })

    it("does not show idle spinner in empty state", () => {
      useAppStore.getState().setTaskChatLoading(false)
      // No messages

      render(<TaskChatPanel />)
      expect(screen.queryByTestId("task-chat-idle-spinner")).not.toBeInTheDocument()
    })

    it("shows waiting placeholder when loading", () => {
      useAppStore.getState().setTaskChatLoading(true)

      render(<TaskChatPanel />)
      expect(screen.getByPlaceholderText("Waiting for response...")).toBeInTheDocument()
    })

    it("allows typing while loading", () => {
      useAppStore.getState().setTaskChatLoading(true)

      render(<TaskChatPanel />)
      // Input should NOT be disabled during loading - user can type ahead
      expect(screen.getByRole("textbox")).not.toBeDisabled()
    })
  })

  describe("connection state", () => {
    it("disables input when disconnected", () => {
      useAppStore.getState().setConnectionStatus("disconnected")

      render(<TaskChatPanel />)
      expect(screen.getByRole("textbox")).toBeDisabled()
    })

    it("shows connecting placeholder when disconnected", () => {
      useAppStore.getState().setConnectionStatus("disconnected")

      render(<TaskChatPanel />)
      expect(screen.getByPlaceholderText("Connecting...")).toBeInTheDocument()
    })
  })

  describe("sending messages", () => {
    it("sends message on submit", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello" } })
      fireEvent.submit(input.closest("form")!)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/task-chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Hello", history: [] }),
        })
      })
    })

    it("adds user message to store immediately", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      await act(async () => {
        fireEvent.change(input, { target: { value: "Test message" } })
        fireEvent.submit(input.closest("form")!)
      })

      // User message should appear immediately
      expect(screen.getByText("Test message")).toBeInTheDocument()

      // Wait for async operations to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it("shows error message on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "Failed to process" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello" } })
      fireEvent.submit(input.closest("form")!)

      await waitFor(() => {
        expect(screen.getByText(/Error: Failed to process/)).toBeInTheDocument()
      })
    })

    it("removes optimistic message and syncs loading state on 'request already in progress' error", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "A request is already in progress" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      await act(async () => {
        fireEvent.change(input, { target: { value: "Hello" } })
        fireEvent.submit(input.closest("form")!)
      })

      // Wait for the response to be processed
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // The user message should be removed (not visible)
      // and no error message should be shown
      expect(screen.queryByText("Hello")).not.toBeInTheDocument()
      expect(screen.queryByText(/Error:/)).not.toBeInTheDocument()

      // Loading state should stay true (synced with server)
      expect(useAppStore.getState().taskChatLoading).toBe(true)
    })

    it("clears input after sending", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      await act(async () => {
        fireEvent.change(input, { target: { value: "Hello" } })
        fireEvent.submit(input.closest("form")!)
      })

      expect(input).toHaveValue("")

      // Wait for async operations to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it("focuses input after loading completes", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      await act(async () => {
        fireEvent.change(input, { target: { value: "Hello" } })
        fireEvent.submit(input.closest("form")!)
      })

      // Wait for async operations to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Input is NOT disabled while loading - user can type ahead
      expect(input).not.toBeDisabled()

      // Simulate loading completing (as would happen via WebSocket)
      await act(async () => {
        useAppStore.getState().setTaskChatLoading(false)
      })

      // Input should be focused after loading completes
      expect(input).not.toBeDisabled()
      expect(input).toHaveFocus()
    })
  })

  describe("clear history", () => {
    it("calls API to clear history", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      })

      render(<TaskChatPanel />)
      const clearButton = screen.getByRole("button", { name: "Clear chat history" })

      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/task-chat/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      })
    })

    it("clears messages from store on success", async () => {
      // Add messages first
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      })

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      })

      render(<TaskChatPanel />)
      expect(screen.getByText("Hello")).toBeInTheDocument()

      const clearButton = screen.getByRole("button", { name: "Clear chat history" })
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.queryByText("Hello")).not.toBeInTheDocument()
        expect(screen.getByText("Manage your tasks")).toBeInTheDocument()
      })
    })

    it("focuses chat input after clearing history", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      })

      render(<TaskChatPanel />)
      const clearButton = screen.getByRole("button", { name: "Clear chat history" })
      const input = screen.getByRole("textbox")

      // Ensure input doesn't have focus initially
      expect(input).not.toHaveFocus()

      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(input).toHaveFocus()
      })
    })
  })

  describe("close button", () => {
    it("calls onClose when close button is clicked", () => {
      const onClose = vi.fn()
      render(<TaskChatPanel onClose={onClose} />)

      const closeButton = screen.getByRole("button", { name: "Close task chat" })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe("accessibility", () => {
    it("has correct ARIA label for messages container", () => {
      render(<TaskChatPanel />)
      expect(screen.getByRole("log")).toHaveAttribute("aria-label", "Task chat messages")
    })

    it("has correct ARIA label for input", () => {
      render(<TaskChatPanel />)
      expect(screen.getByLabelText("Task chat input")).toBeInTheDocument()
    })
  })

  describe("timeout recovery", () => {
    it("sets up a timeout when sending a message", async () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout")
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      await act(async () => {
        fireEvent.change(input, { target: { value: "Hello" } })
        fireEvent.submit(input.closest("form")!)
      })

      // Wait for fetch to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Should have set a 60 second timeout
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000)

      setTimeoutSpy.mockRestore()
    })

    it("clears timeout when API returns error", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "Failed to process" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      await act(async () => {
        fireEvent.change(input, { target: { value: "Hello" } })
        fireEvent.submit(input.closest("form")!)
      })

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Error: Failed to process/)).toBeInTheDocument()
      })

      // Timeout should have been cleared
      expect(clearTimeoutSpy).toHaveBeenCalled()

      clearTimeoutSpy.mockRestore()
    })

    it("re-sets timeout when request already in progress error is received", async () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout")

      // Return "already in progress" error (simulates a retry when server is busy)
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, error: "A request is already in progress" }),
      })

      render(<TaskChatPanel />)
      const input = screen.getByRole("textbox")

      // Send message
      await act(async () => {
        fireEvent.change(input, { target: { value: "Hello" } })
        fireEvent.submit(input.closest("form")!)
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // The timeout should be called twice: once initially, and once after "already in progress"
      // (the first one is cleared and a new one is set)
      const timeoutCalls = setTimeoutSpy.mock.calls.filter(call => call[1] === 60000)

      // Should have at least 2 timeout calls (initial + re-set after "already in progress")
      expect(timeoutCalls.length).toBeGreaterThanOrEqual(2)

      setTimeoutSpy.mockRestore()
    })
  })

  describe("tool use display", () => {
    it("renders tool uses in the chat", () => {
      // Add an assistant event with a tool use via SDK events
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "bd list" } },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)
      expect(screen.getByText("Bash")).toBeInTheDocument()
    })

    it("shows tool use with Read tool", () => {
      // Add an assistant event with a Read tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "/test/file.ts" } },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it("renders tool uses from different tools", () => {
      // Add an assistant event with a Bash tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "invalid" } },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)
      expect(screen.getByText("Bash")).toBeInTheDocument()
    })

    it("keeps tool uses visible when sending a new message", async () => {
      // Add an assistant event with a tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "bd list" } },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, status: "processing" }),
      })

      render(<TaskChatPanel />)
      // Tool use should be visible initially
      expect(screen.getByText("Bash")).toBeInTheDocument()

      const input = screen.getByRole("textbox")

      await act(async () => {
        fireEvent.change(input, { target: { value: "Next message" } })
        fireEvent.submit(input.closest("form")!)
      })

      // Tool uses should remain visible after sending a new message
      expect(screen.getByText("Bash")).toBeInTheDocument()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it("keeps tool uses visible after assistant message completes", () => {
      const baseTime = Date.now()

      // Add user message first
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Check my tasks",
        timestamp: baseTime,
      })

      // Add an assistant event with tool use followed by text (simulating interleaved content)
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: baseTime + 1,
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "bd list" } },
            { type: "text", text: "Here are your tasks..." },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      // User message should be visible
      expect(screen.getByText("Check my tasks")).toBeInTheDocument()
      // Assistant text should be visible
      expect(screen.getByText("Here are your tasks...")).toBeInTheDocument()
      // Tool use should be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
    })

    it("hides empty state when tool uses are present", () => {
      // Add an assistant event with a tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [{ type: "tool_use", id: "tool-1", name: "Grep", input: { pattern: "test" } }],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)
      expect(screen.queryByText("Manage your tasks")).not.toBeInTheDocument()
    })

    it("interleaves messages and tool uses in timestamp order", () => {
      const baseTime = 1000000

      // Add user message at t=0
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "First user message",
        timestamp: baseTime,
      })

      // Add an assistant event with tool use followed by text (proper interleaving in SDK model)
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: baseTime + 1,
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "bd list" } },
            { type: "text", text: "Assistant response" },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      // Get all rendered elements
      const userMsg = screen.getByText("First user message")
      const toolUse = screen.getByText("Bash")
      const assistantMsg = screen.getByText("Assistant response")

      // Verify all elements are present
      expect(userMsg).toBeInTheDocument()
      expect(toolUse).toBeInTheDocument()
      expect(assistantMsg).toBeInTheDocument()

      // Verify the order: user message should come before tool use,
      // which should come before assistant text (content blocks are rendered in order)
      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // Verify elements appear in correct order in the DOM
      const userPos = textContent.indexOf("First user message")
      const toolPos = textContent.indexOf("Bash")
      const assistantPos = textContent.indexOf("Assistant response")

      expect(userPos).toBeLessThan(toolPos)
      expect(toolPos).toBeLessThan(assistantPos)
    })

    it("deduplicates tool uses from streaming and final events", () => {
      const baseTime = Date.now()
      // Add the same assistant event content from SDK - tool use should only appear once
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: baseTime,
        message: {
          content: [
            { type: "tool_use", id: "tool-duplicate", name: "Bash", input: { command: "bd list" } },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      // Should only show one Bash tool use, not two
      const bashElements = screen.getAllByText("Bash")
      expect(bashElements).toHaveLength(1)
    })

    it("renders tool uses in content block order (SDK model)", () => {
      const baseTime = 1000000

      // Add user message
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "User question",
        timestamp: baseTime,
      })

      // Add assistant event with multiple tool uses in a specific order
      // The content blocks should be rendered in the order they appear in the array
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: baseTime + 1,
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "/test.ts" } },
            { type: "tool_use", id: "tool-2", name: "Grep", input: { pattern: "search" } },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // Verify all elements are present
      expect(screen.getByText("User question")).toBeInTheDocument()
      expect(screen.getByText("Read")).toBeInTheDocument()
      expect(screen.getByText("Grep")).toBeInTheDocument()

      // Read should come before Grep (as ordered in the content blocks array)
      const readPos = textContent.indexOf("Read")
      const grepPos = textContent.indexOf("Grep")

      expect(readPos).toBeLessThan(grepPos)
    })

    it("renders user message before assistant content (timestamp ordering)", () => {
      const baseTime = 1000000

      // Add user message (will have earlier timestamp)
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "User message",
        timestamp: baseTime,
      })

      // Add assistant event with tool use (later timestamp)
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: baseTime + 1,
        message: {
          content: [{ type: "tool_use", id: "tool-1", name: "Bash", input: { command: "test" } }],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // User message should appear before tool use (sorted by timestamp)
      const userPos = textContent.indexOf("User message")
      const toolPos = textContent.indexOf("Bash")

      expect(userPos).toBeLessThan(toolPos)
    })

    it("orders user message → tool uses → assistant text correctly (SDK model)", () => {
      const baseTime = 1000000

      // Add user message
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "User question",
        timestamp: baseTime,
      })

      // Add assistant event with tool uses followed by text response
      // In the SDK model, all of this comes as content blocks in a single assistant event
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: baseTime + 1,
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "/test.ts" } },
            { type: "tool_use", id: "tool-2", name: "Grep", input: { pattern: "search" } },
            { type: "text", text: "Here is my response" },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // Verify order: user → Read → Grep → assistant text
      const userPos = textContent.indexOf("User question")
      const readPos = textContent.indexOf("Read")
      const grepPos = textContent.indexOf("Grep")
      const assistantPos = textContent.indexOf("Here is my response")

      expect(userPos).toBeLessThan(readPos)
      expect(readPos).toBeLessThan(grepPos)
      expect(grepPos).toBeLessThan(assistantPos)
    })
  })

  describe("showToolOutput toggle", () => {
    it("hides tool output when showToolOutput is false", () => {
      useAppStore.getState().setShowToolOutput(false)

      // Add an assistant event with a Bash tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "echo test" } },
          ],
        },
      } as any)
      // Add tool result (needs tool_use_result: true for isToolResultEvent check)
      useAppStore.getState().addTaskChatEvent({
        type: "user",
        timestamp: Date.now() + 1,
        tool_use_result: true,
        message: {
          content: [
            { type: "tool_result", tool_use_id: "tool-1", content: "test output", is_error: false },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      // Tool name and command should still be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
      expect(screen.getByText("echo test")).toBeInTheDocument()
      // Tool output should NOT be visible
      expect(screen.queryByText("test output")).not.toBeInTheDocument()
    })

    it("shows tool output when showToolOutput is true", () => {
      useAppStore.getState().setShowToolOutput(true)

      // Add an assistant event with a Bash tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "echo test" } },
          ],
        },
      } as any)
      // Add tool result (needs tool_use_result: true for isToolResultEvent check)
      useAppStore.getState().addTaskChatEvent({
        type: "user",
        timestamp: Date.now() + 1,
        tool_use_result: true,
        message: {
          content: [
            { type: "tool_result", tool_use_id: "tool-1", content: "test output", is_error: false },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      // Tool name, command, and output should all be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
      expect(screen.getByText("echo test")).toBeInTheDocument()
      expect(screen.getByText("test output")).toBeInTheDocument()
    })

    it("toggles tool output visibility with toggleToolOutput", () => {
      useAppStore.getState().setShowToolOutput(false)

      // Add an assistant event with a Bash tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "echo test" } },
          ],
        },
      } as any)
      // Add tool result (needs tool_use_result: true for isToolResultEvent check)
      useAppStore.getState().addTaskChatEvent({
        type: "user",
        timestamp: Date.now() + 1,
        tool_use_result: true,
        message: {
          content: [
            { type: "tool_result", tool_use_id: "tool-1", content: "test output", is_error: false },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      const { rerender } = render(<TaskChatPanel />)

      // Initially hidden
      expect(screen.queryByText("test output")).not.toBeInTheDocument()

      // Toggle to show
      act(() => {
        useAppStore.getState().toggleToolOutput()
      })
      rerender(<TaskChatPanel />)

      // Now visible
      expect(screen.getByText("test output")).toBeInTheDocument()
    })

    it("automatically updates when showToolOutput changes (no manual rerender)", async () => {
      useAppStore.getState().setShowToolOutput(false)

      // Add an assistant event with a Bash tool use
      useAppStore.getState().addTaskChatEvent({
        type: "assistant",
        timestamp: Date.now(),
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "echo test" } },
          ],
        },
      } as any)
      // Add tool result
      useAppStore.getState().addTaskChatEvent({
        type: "user",
        timestamp: Date.now() + 1,
        tool_use_result: true,
        message: {
          content: [
            { type: "tool_result", tool_use_id: "tool-1", content: "test output", is_error: false },
          ],
        },
      } as any)
      flushTaskChatEventsBatch()

      render(<TaskChatPanel />)

      // Initially hidden
      expect(screen.queryByText("test output")).not.toBeInTheDocument()

      // Toggle to show - component should automatically re-render
      act(() => {
        useAppStore.getState().toggleToolOutput()
      })

      // Wait for the component to re-render (no manual rerender!)
      await waitFor(() => {
        expect(screen.getByText("test output")).toBeInTheDocument()
      })
    })
  })
})
