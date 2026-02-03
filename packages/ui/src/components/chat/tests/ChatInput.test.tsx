import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ChatInput, type ChatInputHandle } from ".././ChatInput"
import { createRef } from "react"

const TEST_STORAGE_KEY = "test-chat-input-draft"

describe("ChatInput", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe("rendering", () => {
    it("renders input with default placeholder", () => {
      render(<ChatInput />)
      expect(screen.getByPlaceholderText("Send Ralph a message...")).toBeInTheDocument()
    })

    it("renders input with custom placeholder", () => {
      render(<ChatInput placeholder="Send a command..." />)
      expect(screen.getByPlaceholderText("Send a command...")).toBeInTheDocument()
    })

    it("renders send button", () => {
      render(<ChatInput />)
      expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(<ChatInput className="custom-class" />)
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("input behavior", () => {
    it("updates value on change", () => {
      render(<ChatInput />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello world" } })

      expect(input).toHaveValue("Hello world")
    })

    it("clears input after submit", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello world" } })
      fireEvent.submit(input.closest("form")!)

      expect(input).toHaveValue("")
    })

    it("has correct ARIA label", () => {
      render(<ChatInput />)
      expect(screen.getByLabelText("Message input")).toBeInTheDocument()
    })
  })

  describe("submit behavior", () => {
    it("calls onSubmit with trimmed message on form submit", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "  Hello world  " } })
      fireEvent.submit(input.closest("form")!)

      expect(handleSubmit).toHaveBeenCalledWith("Hello world")
    })

    it("calls onSubmit when Enter is pressed", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello world" } })
      fireEvent.keyDown(input, { key: "Enter" })

      expect(handleSubmit).toHaveBeenCalledWith("Hello world")
    })

    it("does not submit when Shift+Enter is pressed", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello world" } })
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true })

      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it("does not submit empty message", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)

      fireEvent.submit(screen.getByRole("textbox").closest("form")!)

      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it("does not submit whitespace-only message", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "   " } })
      fireEvent.submit(input.closest("form")!)

      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it("calls onSubmit when button is clicked", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")
      const button = screen.getByRole("button", { name: "Send message" })

      fireEvent.change(input, { target: { value: "Hello world" } })
      fireEvent.click(button)

      expect(handleSubmit).toHaveBeenCalledWith("Hello world")
    })
  })

  describe("disabled state", () => {
    it("disables input when disabled prop is true", () => {
      render(<ChatInput disabled />)
      expect(screen.getByRole("textbox")).toBeDisabled()
    })

    it("disables button when disabled prop is true", () => {
      render(<ChatInput disabled />)
      expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled()
    })

    it("disables button when input is empty", () => {
      render(<ChatInput />)
      expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled()
    })

    it("enables button when input has content", () => {
      render(<ChatInput />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello" } })

      expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled()
    })

    it("does not submit when disabled even with content", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} disabled />)
      const input = screen.getByRole("textbox")

      fireEvent.change(input, { target: { value: "Hello world" } })
      fireEvent.keyDown(input, { key: "Enter" })

      expect(handleSubmit).not.toHaveBeenCalled()
    })
  })

  describe("auto-expanding", () => {
    it("starts with a single row", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveAttribute("rows", "1")
    })

    it("uses CSS field-sizing-content for auto-resize", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox")
      // The Textarea component uses field-sizing-content CSS property for auto-sizing
      expect(textarea).toHaveClass("field-sizing-content")
    })

    it("has resize disabled", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveClass("resize-none")
    })
  })

  describe("styling", () => {
    it("textarea has borderless styling", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveClass("bg-transparent", "border-0", "resize-none")
    })

    it("button has correct base classes", () => {
      render(<ChatInput />)
      const button = screen.getByRole("button", { name: "Send message" })
      // Button uses InputGroupButton component, check structure classes
      expect(button).toHaveClass("rounded-md")
    })

    it("button uses accent color CSS classes", () => {
      render(<ChatInput />)
      const button = screen.getByRole("button", { name: "Send message" })
      // Button uses CSS custom property classes for accent color styling
      expect(button).toHaveClass("bg-repo-accent", "text-repo-accent-foreground")
    })
  })

  describe("localStorage persistence", () => {
    it("does not persist when storageKey is not provided", () => {
      render(<ChatInput />)

      const input = screen.getByRole("textbox")
      fireEvent.change(input, { target: { value: "Test message" } })

      // No localStorage key should be set
      expect(localStorage.getItem(TEST_STORAGE_KEY)).toBeNull()
    })

    it("persists input value to localStorage as user types", () => {
      render(<ChatInput storageKey={TEST_STORAGE_KEY} />)

      const input = screen.getByRole("textbox")
      fireEvent.change(input, { target: { value: "My draft message" } })

      expect(localStorage.getItem(TEST_STORAGE_KEY)).toBe("My draft message")
    })

    it("restores input value from localStorage on mount", () => {
      localStorage.setItem(TEST_STORAGE_KEY, "Saved draft message")

      render(<ChatInput storageKey={TEST_STORAGE_KEY} />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveValue("Saved draft message")
    })

    it("clears localStorage when input is cleared", () => {
      render(<ChatInput storageKey={TEST_STORAGE_KEY} />)

      const input = screen.getByRole("textbox")
      fireEvent.change(input, { target: { value: "Some text" } })
      expect(localStorage.getItem(TEST_STORAGE_KEY)).toBe("Some text")

      fireEvent.change(input, { target: { value: "" } })
      expect(localStorage.getItem(TEST_STORAGE_KEY)).toBeNull()
    })

    it("clears localStorage after successful submission", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} storageKey={TEST_STORAGE_KEY} />)

      const input = screen.getByRole("textbox")
      fireEvent.change(input, { target: { value: "Message to send" } })
      expect(localStorage.getItem(TEST_STORAGE_KEY)).toBe("Message to send")

      fireEvent.submit(input.closest("form")!)

      expect(handleSubmit).toHaveBeenCalledWith("Message to send")
      // After submit, input is cleared which triggers localStorage removal
      expect(localStorage.getItem(TEST_STORAGE_KEY)).toBeNull()
    })

    it("does not read from localStorage without storageKey", () => {
      localStorage.setItem(TEST_STORAGE_KEY, "Should not appear")

      render(<ChatInput />)

      const input = screen.getByRole("textbox")
      expect(input).toHaveValue("")
    })
  })

  describe("message history navigation", () => {
    it("stores submitted messages in history", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      // Send first message
      fireEvent.change(input, { target: { value: "First message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Send second message
      fireEvent.change(input, { target: { value: "Second message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Press ArrowUp to recall last message
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("Second message")

      // Press ArrowUp again to recall first message
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("First message")
    })

    it("navigates forward through history with ArrowDown", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      // Send two messages
      fireEvent.change(input, { target: { value: "First message" } })
      fireEvent.keyDown(input, { key: "Enter" })
      fireEvent.change(input, { target: { value: "Second message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Navigate back through history
      fireEvent.keyDown(input, { key: "ArrowUp" })
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("First message")

      // Navigate forward
      fireEvent.keyDown(input, { key: "ArrowDown" })
      expect(input).toHaveValue("Second message")
    })

    it("returns to empty input when navigating past newest message", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      // Send a message
      fireEvent.change(input, { target: { value: "Test message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Navigate to history
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("Test message")

      // Navigate forward past newest - should return to empty
      fireEvent.keyDown(input, { key: "ArrowDown" })
      expect(input).toHaveValue("")
    })

    it("preserves current draft when navigating history", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox") as HTMLTextAreaElement

      // Send a message
      fireEvent.change(input, { target: { value: "Sent message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Start typing a draft
      fireEvent.change(input, { target: { value: "My draft" } })

      // Position cursor at start (like pressing Home key)
      input.setSelectionRange(0, 0)

      // Navigate to history
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("Sent message")

      // Navigate back to current
      fireEvent.keyDown(input, { key: "ArrowDown" })
      expect(input).toHaveValue("My draft")
    })

    it("does not navigate history when input is empty and no history exists", () => {
      render(<ChatInput />)
      const input = screen.getByRole("textbox")

      // Try to navigate with no history
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("")

      fireEvent.keyDown(input, { key: "ArrowDown" })
      expect(input).toHaveValue("")
    })

    it("stops at oldest message when pressing ArrowUp", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      // Send a message
      fireEvent.change(input, { target: { value: "Only message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Navigate to history
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("Only message")

      // Try to navigate past oldest
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("Only message")
    })

    it("restores draft on Escape during history navigation", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox") as HTMLTextAreaElement

      // Send a message
      fireEvent.change(input, { target: { value: "History message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Start typing a draft
      fireEvent.change(input, { target: { value: "Current draft" } })

      // Position cursor at start (like pressing Home key)
      input.setSelectionRange(0, 0)

      // Navigate to history
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("History message")

      // Press Escape to exit history and restore draft
      fireEvent.keyDown(input, { key: "Escape" })
      expect(input).toHaveValue("Current draft")
    })

    it("clears input on Escape when not navigating history and input has content", () => {
      render(<ChatInput />)
      const input = screen.getByRole("textbox")

      // Type something
      fireEvent.change(input, { target: { value: "Some text" } })

      // Press Escape - should clear
      fireEvent.keyDown(input, { key: "Escape" })
      expect(input).toHaveValue("")
    })

    it("only responds to ArrowUp when cursor is at start of input", () => {
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox") as HTMLTextAreaElement

      // Send a message
      fireEvent.change(input, { target: { value: "History message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Type new content and position cursor in middle
      fireEvent.change(input, { target: { value: "Some text" } })
      // Simulate cursor in middle of text
      Object.defineProperty(input, "selectionStart", { value: 5, writable: true })
      Object.defineProperty(input, "selectionEnd", { value: 5, writable: true })

      // ArrowUp should not navigate history when cursor is not at start
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("Some text")
    })

    it("ArrowDown navigates forward in history regardless of cursor position", () => {
      // Terminal-like behavior: once in history mode, ArrowDown always navigates
      const handleSubmit = vi.fn()
      render(<ChatInput onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox") as HTMLTextAreaElement

      // Send two messages
      fireEvent.change(input, { target: { value: "First" } })
      fireEvent.keyDown(input, { key: "Enter" })
      fireEvent.change(input, { target: { value: "Second" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Navigate to first message
      fireEvent.keyDown(input, { key: "ArrowUp" })
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("First")

      // Position cursor at middle
      input.setSelectionRange(2, 2)

      // ArrowDown still navigates forward because we're in history mode
      fireEvent.keyDown(input, { key: "ArrowDown" })
      expect(input).toHaveValue("Second")
    })

    it("clears history when clearHistory is called on ref", () => {
      const handleSubmit = vi.fn()
      const ref = createRef<ChatInputHandle>()
      render(<ChatInput ref={ref} onSubmit={handleSubmit} />)
      const input = screen.getByRole("textbox")

      // Send a message
      fireEvent.change(input, { target: { value: "Message" } })
      fireEvent.keyDown(input, { key: "Enter" })

      // Verify message is in history
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("Message")

      // Clear history via ref - use type assertion since method will be added
      const handle = ref.current as ChatInputHandle & { clearHistory?: () => void }
      handle.clearHistory?.()

      // Navigate back to empty
      fireEvent.keyDown(input, { key: "ArrowDown" })

      // Try to navigate history again - should be empty
      fireEvent.keyDown(input, { key: "ArrowUp" })
      expect(input).toHaveValue("")
    })
  })
})
