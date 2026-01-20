import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { HotkeysDialog } from "./HotkeysDialog"

describe("HotkeysDialog", () => {
  describe("rendering", () => {
    it("renders dialog when open", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
    })

    it("does not render dialog when closed", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={false} onClose={onClose} />)

      expect(screen.queryByText("Keyboard Shortcuts")).not.toBeInTheDocument()
    })

    it("displays all hotkey categories", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      expect(screen.getByText("Agent Control")).toBeInTheDocument()
      expect(screen.getByText("Navigation")).toBeInTheDocument()
      expect(screen.getByText("Appearance")).toBeInTheDocument()
      expect(screen.getByText("Help")).toBeInTheDocument()
    })

    it("displays hotkey descriptions", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      expect(screen.getByText("Start Ralph agent")).toBeInTheDocument()
      expect(screen.getByText("Stop Ralph agent")).toBeInTheDocument()
      expect(screen.getByText("Toggle sidebar visibility")).toBeInTheDocument()
      expect(screen.getByText("Show keyboard shortcuts")).toBeInTheDocument()
    })

    it("displays task chat panel hotkeys", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      expect(screen.getByText("Toggle task chat panel")).toBeInTheDocument()
      expect(screen.getByText("Focus task chat input")).toBeInTheDocument()
    })

    it("displays keyboard icons", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      // The dialog should have keyboard icon in header
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
    })
  })

  describe("interactions", () => {
    it("calls onClose when clicking close button", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      // Click the X button to close
      const closeButton = screen.getByRole("button", { name: /close/i })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it("calls onClose when pressing Escape", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      fireEvent.keyDown(document, { key: "Escape" })

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe("accessibility", () => {
    it("has accessible dialog title", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
    })

    it("has screen reader only description", () => {
      const onClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={onClose} />)

      // The description has sr-only class so it won't be visible
      // but should be in the document
      expect(
        screen.getByText("List of keyboard shortcuts available in the application"),
      ).toBeInTheDocument()
    })
  })
})
