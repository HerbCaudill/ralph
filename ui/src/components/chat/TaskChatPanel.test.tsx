import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TaskChatPanel } from "./TaskChatPanel"
import { useAppStore } from "@/store"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("TaskChatPanel", () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppStore.getState().clearTaskChatMessages()
    useAppStore.getState().clearTaskChatToolUses()
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
      expect(screen.getByText("Ask questions about your tasks")).toBeInTheDocument()
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
      // Add an assistant message to the store
      useAppStore.getState().addTaskChatMessage({
        id: "assistant-1",
        role: "assistant",
        content: "You can **prioritize** tasks by setting their priority level.",
        timestamp: Date.now(),
      })

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
      useAppStore.getState().addTaskChatMessage({
        id: "assistant-1",
        role: "assistant",
        content: "Second message",
        timestamp: 2,
      })
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
      expect(screen.queryByText("Ask questions about your tasks")).not.toBeInTheDocument()
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
      expect(screen.getByText("Thinking...")).toBeInTheDocument()
    })

    it("shows waiting placeholder when loading", () => {
      useAppStore.getState().setTaskChatLoading(true)

      render(<TaskChatPanel />)
      expect(screen.getByPlaceholderText("Waiting for response...")).toBeInTheDocument()
    })

    it("disables input when loading", () => {
      useAppStore.getState().setTaskChatLoading(true)

      render(<TaskChatPanel />)
      expect(screen.getByRole("textbox")).toBeDisabled()
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
          body: JSON.stringify({ message: "Hello" }),
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

      // Input is disabled while loading
      expect(input).toBeDisabled()

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
        expect(screen.getByText("Ask questions about your tasks")).toBeInTheDocument()
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
      // Add a tool use to the store
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Bash",
        input: { command: "bd list" },
        status: "running",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.getByText("Bash")).toBeInTheDocument()
    })

    it("shows tool output when tool completes", () => {
      // Add a completed tool use
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Read",
        input: { file_path: "/test/file.ts" },
        output: "file contents here",
        status: "success",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.getByText("Read")).toBeInTheDocument()
    })

    it("shows tool error status", () => {
      // Add a failed tool use
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Bash",
        input: { command: "invalid" },
        error: "Command failed",
        status: "error",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.getByText("Bash")).toBeInTheDocument()
    })

    it("clears tool uses when sending a new message", async () => {
      // Add a tool use to the store
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Bash",
        input: { command: "bd list" },
        status: "success",
        timestamp: Date.now(),
      })

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

      // Tool use should be cleared when new message is sent
      expect(screen.queryByText("Bash")).not.toBeInTheDocument()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it("keeps tool uses visible after assistant message completes", () => {
      // Add messages first
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Check my tasks",
        timestamp: Date.now(),
      })

      // Add a tool use (as would happen during assistant response)
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Bash",
        input: { command: "bd list" },
        status: "success",
        timestamp: Date.now(),
      })

      // Add assistant message (as would happen after tools complete)
      useAppStore.getState().addTaskChatMessage({
        id: "assistant-1",
        role: "assistant",
        content: "Here are your tasks...",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)

      // Both messages should be visible
      expect(screen.getByText("Check my tasks")).toBeInTheDocument()
      expect(screen.getByText("Here are your tasks...")).toBeInTheDocument()

      // Tool use should still be visible
      expect(screen.getByText("Bash")).toBeInTheDocument()
    })

    it("hides empty state when tool uses are present", () => {
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Grep",
        input: { pattern: "test" },
        status: "running",
        timestamp: Date.now(),
      })

      render(<TaskChatPanel />)
      expect(screen.queryByText("Ask questions about your tasks")).not.toBeInTheDocument()
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

      // Add tool use at t=1
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Bash",
        input: { command: "bd list" },
        status: "success",
        timestamp: baseTime + 1,
      })

      // Add assistant message at t=2 (after the tool use)
      useAppStore.getState().addTaskChatMessage({
        id: "assistant-1",
        role: "assistant",
        content: "Assistant response",
        timestamp: baseTime + 2,
      })

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
      // which should come before assistant message
      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // Verify elements appear in correct order in the DOM
      const userPos = textContent.indexOf("First user message")
      const toolPos = textContent.indexOf("Bash")
      const assistantPos = textContent.indexOf("Assistant response")

      expect(userPos).toBeLessThan(toolPos)
      expect(toolPos).toBeLessThan(assistantPos)
    })

    it("deduplicates tool uses with the same toolUseId", () => {
      const baseTime = Date.now()
      // Add a tool use with pending status (simulating content_block_start)
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-duplicate",
        tool: "Bash",
        input: {},
        status: "pending",
        timestamp: baseTime,
      })

      // Add the same tool use again (simulating duplicate from assistant message)
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-duplicate",
        tool: "Bash",
        input: { command: "bd list" },
        status: "running",
        timestamp: baseTime + 1,
      })

      render(<TaskChatPanel />)

      // Should only show one Bash tool use, not two
      const bashElements = screen.getAllByText("Bash")
      expect(bashElements).toHaveLength(1)

      // Verify the state was updated, not duplicated
      const toolUses = useAppStore.getState().taskChatToolUses
      expect(toolUses.filter(t => t.toolUseId === "tool-duplicate")).toHaveLength(1)
      // The status should be updated to the latest value
      expect(toolUses.find(t => t.toolUseId === "tool-duplicate")?.status).toBe("running")
      // The input should be updated to the latest value
      expect(toolUses.find(t => t.toolUseId === "tool-duplicate")?.input).toEqual({
        command: "bd list",
      })
    })

    it("sorts by sequence number when available (even with out-of-order timestamps)", () => {
      const baseTime = 1000000

      // Add user message (no sequence)
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "User question",
        timestamp: baseTime,
      })

      // Add tool uses with sequence numbers (but timestamps are deliberately out of order)
      // Tool 2 has an earlier timestamp but higher sequence - should appear AFTER tool 1
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-2",
        tool: "Grep",
        input: { pattern: "search" },
        status: "success",
        timestamp: baseTime + 1, // Earlier timestamp
        sequence: 1, // Higher sequence
      })

      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Read",
        input: { file_path: "/test.ts" },
        status: "success",
        timestamp: baseTime + 2, // Later timestamp
        sequence: 0, // Lower sequence - should appear first
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // Verify all elements are present
      expect(screen.getByText("User question")).toBeInTheDocument()
      expect(screen.getByText("Read")).toBeInTheDocument()
      expect(screen.getByText("Grep")).toBeInTheDocument()

      // Read (sequence 0) should come before Grep (sequence 1)
      // even though Grep has an earlier timestamp
      const readPos = textContent.indexOf("Read")
      const grepPos = textContent.indexOf("Grep")

      expect(readPos).toBeLessThan(grepPos)
    })

    it("puts messages without sequence before tool uses with sequence", () => {
      const baseTime = 1000000

      // Add a tool use with sequence
      useAppStore.getState().addTaskChatToolUse({
        toolUseId: "tool-1",
        tool: "Bash",
        input: { command: "test" },
        status: "success",
        timestamp: baseTime, // Earlier timestamp
        sequence: 0,
      })

      // Add user message without sequence (later timestamp but no sequence)
      useAppStore.getState().addTaskChatMessage({
        id: "user-1",
        role: "user",
        content: "Later message",
        timestamp: baseTime + 1000, // Later timestamp
      })

      render(<TaskChatPanel />)

      const container = screen.getByRole("log", { name: "Task chat messages" })
      const textContent = container.textContent || ""

      // Messages without sequence should come before tool uses with sequence
      // because user messages arrive before the response (which contains tool uses)
      const userPos = textContent.indexOf("Later message")
      const toolPos = textContent.indexOf("Bash")

      // User message should appear before tool use since it has no sequence
      expect(userPos).toBeLessThan(toolPos)
    })
  })
})
