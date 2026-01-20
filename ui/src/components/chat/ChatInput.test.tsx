import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ChatInput } from "./ChatInput"
import { useAppStore } from "@/store"

describe("ChatInput", () => {
  beforeEach(() => {
    // Reset the store before each test
    useAppStore.getState().setAccentColor(null)
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

    it("has overflow hidden for auto-resize", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveClass("overflow-hidden")
    })

    it("adjusts height when content changes", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement

      // Type multiline content
      fireEvent.change(textarea, { target: { value: "Line 1\nLine 2\nLine 3" } })

      // Height should be set dynamically via style
      expect(textarea.style.height).toBeTruthy()
    })

    it("resets height when content is cleared", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement

      // Add content
      fireEvent.change(textarea, { target: { value: "Line 1\nLine 2\nLine 3" } })
      const expandedHeight = textarea.style.height

      // Clear content
      fireEvent.change(textarea, { target: { value: "" } })

      // Height should be recalculated (may be different from expanded)
      expect(textarea.style.height).toBeTruthy()
      // After clearing, the height should be less than or equal to expanded height
      expect(parseInt(textarea.style.height)).toBeLessThanOrEqual(parseInt(expandedHeight))
    })
  })

  describe("styling", () => {
    it("textarea has borderless styling", () => {
      render(<ChatInput />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveClass("bg-transparent", "border-0", "resize-none")
    })

    it("button has correct base classes and accent color styling", () => {
      render(<ChatInput />)
      const button = screen.getByRole("button", { name: "Send message" })
      // Button uses inline styles for accent color, check structure classes
      expect(button).toHaveClass("rounded-md", "inline-flex", "shrink-0")
      // Default accent color is black with white text
      expect(button).toHaveStyle({ backgroundColor: "#000000", color: "#ffffff" })
    })

    it("button uses accent color from store", () => {
      // Set a custom accent color
      useAppStore.getState().setAccentColor("#007ACC")

      render(<ChatInput />)
      const button = screen.getByRole("button", { name: "Send message" })
      // Blue accent color with white text (dark background)
      expect(button).toHaveStyle({ backgroundColor: "#007ACC", color: "#ffffff" })
    })

    it("button uses black text for light accent colors", () => {
      // Set a light accent color
      useAppStore.getState().setAccentColor("#FFA500")

      render(<ChatInput />)
      const button = screen.getByRole("button", { name: "Send message" })
      // Orange accent color with black text (light background)
      expect(button).toHaveStyle({ backgroundColor: "#FFA500", color: "#000000" })
    })
  })
})
