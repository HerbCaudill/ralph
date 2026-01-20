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
})
