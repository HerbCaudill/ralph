import { createRef } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { ChatInput } from "../ChatInput"
import type { ChatInputHandle } from "../ChatInput"

describe("ChatInput", () => {
  describe("rendering", () => {
    it("renders textarea with default placeholder", () => {
      render(<ChatInput onSend={() => {}} />)
      expect(screen.getByPlaceholderText("Send a message…")).toBeInTheDocument()
    })

    it("renders textarea with custom placeholder", () => {
      render(<ChatInput onSend={() => {}} placeholder="Ask anything..." />)
      expect(screen.getByPlaceholderText("Ask anything...")).toBeInTheDocument()
    })

    it("renders send button", () => {
      render(<ChatInput onSend={() => {}} />)
      expect(screen.getByTitle("Send message")).toBeInTheDocument()
    })

    it("starts with a single row", () => {
      render(<ChatInput onSend={() => {}} />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveAttribute("rows", "1")
    })

    it("textarea has resize disabled", () => {
      render(<ChatInput onSend={() => {}} />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveClass("resize-none")
    })
  })

  describe("input behavior", () => {
    it("updates value on change", () => {
      render(<ChatInput onSend={() => {}} />)
      const textarea = screen.getByRole("textbox")
      fireEvent.change(textarea, { target: { value: "Hello world" } })
      expect(textarea).toHaveValue("Hello world")
    })

    it("clears input after send", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} />)
      const textarea = screen.getByRole("textbox")

      fireEvent.change(textarea, { target: { value: "Hello world" } })
      fireEvent.keyDown(textarea, { key: "Enter" })

      expect(textarea).toHaveValue("")
    })

    it("retains focus after sending a message", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} />)
      const textarea = screen.getByRole("textbox")

      fireEvent.change(textarea, { target: { value: "Hello world" } })
      fireEvent.keyDown(textarea, { key: "Enter" })

      expect(textarea).toHaveFocus()
    })
  })

  describe("submit behavior", () => {
    it("calls onSend with trimmed message on Enter", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} />)
      const textarea = screen.getByRole("textbox")

      fireEvent.change(textarea, { target: { value: "  Hello world  " } })
      fireEvent.keyDown(textarea, { key: "Enter" })

      expect(handleSend).toHaveBeenCalledWith("Hello world")
    })

    it("does not submit when Shift+Enter is pressed", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} />)
      const textarea = screen.getByRole("textbox")

      fireEvent.change(textarea, { target: { value: "Hello world" } })
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })

      expect(handleSend).not.toHaveBeenCalled()
    })

    it("does not submit empty message", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} />)
      const textarea = screen.getByRole("textbox")

      fireEvent.keyDown(textarea, { key: "Enter" })

      expect(handleSend).not.toHaveBeenCalled()
    })

    it("does not submit whitespace-only message", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} />)
      const textarea = screen.getByRole("textbox")

      fireEvent.change(textarea, { target: { value: "   " } })
      fireEvent.keyDown(textarea, { key: "Enter" })

      expect(handleSend).not.toHaveBeenCalled()
    })

    it("calls onSend when send button is clicked", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} />)
      const textarea = screen.getByRole("textbox")

      fireEvent.change(textarea, { target: { value: "Hello world" } })
      fireEvent.click(screen.getByTitle("Send message"))

      expect(handleSend).toHaveBeenCalledWith("Hello world")
    })
  })

  describe("disabled state", () => {
    it("disables textarea when disabled prop is true", () => {
      render(<ChatInput onSend={() => {}} disabled />)
      expect(screen.getByRole("textbox")).toBeDisabled()
    })

    it("focuses textarea when rendered with disabled=false", () => {
      render(<ChatInput onSend={() => {}} />)
      expect(screen.getByRole("textbox")).toHaveFocus()
    })

    it("does not focus textarea when rendered with disabled=true", () => {
      render(<ChatInput onSend={() => {}} disabled />)
      expect(screen.getByRole("textbox")).not.toHaveFocus()
    })

    it("focuses textarea when disabled changes from true to false", () => {
      const { rerender } = render(<ChatInput onSend={() => {}} disabled />)
      expect(screen.getByRole("textbox")).not.toHaveFocus()

      rerender(<ChatInput onSend={() => {}} disabled={false} />)
      expect(screen.getByRole("textbox")).toHaveFocus()
    })

    it("disables send button when input is empty", () => {
      render(<ChatInput onSend={() => {}} />)
      expect(screen.getByTitle("Send message")).toBeDisabled()
    })

    it("enables send button when input has content", () => {
      render(<ChatInput onSend={() => {}} />)
      const textarea = screen.getByRole("textbox")
      fireEvent.change(textarea, { target: { value: "Hello" } })
      expect(screen.getByTitle("Send message")).not.toBeDisabled()
    })

    it("disables send button when disabled even with content", () => {
      render(<ChatInput onSend={() => {}} disabled />)
      const textarea = screen.getByRole("textbox")
      fireEvent.change(textarea, { target: { value: "Hello" } })
      expect(screen.getByTitle("Send message")).toBeDisabled()
    })

    it("does not submit when disabled even with content", () => {
      const handleSend = vi.fn()
      render(<ChatInput onSend={handleSend} disabled />)
      const textarea = screen.getByRole("textbox")

      fireEvent.change(textarea, { target: { value: "Hello world" } })
      fireEvent.keyDown(textarea, { key: "Enter" })

      expect(handleSend).not.toHaveBeenCalled()
    })
  })

  describe("ref forwarding", () => {
    it("exposes a focus method via ref", () => {
      const ref = createRef<ChatInputHandle>()
      render(<ChatInput ref={ref} onSend={() => {}} />)
      expect(ref.current).not.toBeNull()
      expect(typeof ref.current!.focus).toBe("function")
    })

    it("focus() moves focus to the textarea", () => {
      const ref = createRef<ChatInputHandle>()
      render(<ChatInput ref={ref} onSend={() => {}} />)
      const textarea = screen.getByRole("textbox")

      // blur it first so we can verify the imperative focus call works
      textarea.blur()
      expect(textarea).not.toHaveFocus()

      ref.current!.focus()
      expect(textarea).toHaveFocus()
    })
  })

  describe("styling", () => {
    it("textarea has expected base classes", () => {
      render(<ChatInput onSend={() => {}} />)
      const textarea = screen.getByRole("textbox")
      expect(textarea).toHaveClass("resize-none", "bg-muted", "text-sm")
    })

    it("send button has primary styling", () => {
      render(<ChatInput onSend={() => {}} />)
      const button = screen.getByTitle("Send message")
      expect(button).toHaveClass("bg-primary", "text-primary-foreground")
    })
  })
})
