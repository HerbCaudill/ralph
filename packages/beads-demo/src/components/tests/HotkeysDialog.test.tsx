import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { HotkeysDialog } from ".././HotkeysDialog"

// jsdom does not implement HTMLDialogElement.showModal/close, so we polyfill them.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "")
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open")
  })
})

const sampleHotkeys = [
  { action: "newTask", display: "N", description: "New task" },
  { action: "search", display: "Cmd+K", description: "Search" },
  { action: "help", display: "?", description: "Show help" },
]

describe("HotkeysDialog", () => {
  describe("when open", () => {
    it("calls showModal on the dialog element", () => {
      render(<HotkeysDialog open={true} onClose={() => {}} hotkeys={sampleHotkeys} />)
      expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    })

    it("displays the title", () => {
      render(<HotkeysDialog open={true} onClose={() => {}} hotkeys={sampleHotkeys} />)
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
    })

    it("displays all hotkey descriptions", () => {
      render(<HotkeysDialog open={true} onClose={() => {}} hotkeys={sampleHotkeys} />)
      expect(screen.getByText("New task")).toBeInTheDocument()
      expect(screen.getByText("Search")).toBeInTheDocument()
      expect(screen.getByText("Show help")).toBeInTheDocument()
    })

    it("displays all hotkey key displays", () => {
      render(<HotkeysDialog open={true} onClose={() => {}} hotkeys={sampleHotkeys} />)
      expect(screen.getByText("N")).toBeInTheDocument()
      expect(screen.getByText("Cmd+K")).toBeInTheDocument()
      expect(screen.getByText("?")).toBeInTheDocument()
    })

    it("renders key displays inside kbd elements", () => {
      render(<HotkeysDialog open={true} onClose={() => {}} hotkeys={sampleHotkeys} />)
      const kbd = screen.getByText("Cmd+K")
      expect(kbd.tagName).toBe("KBD")
    })
  })

  describe("when closed", () => {
    it("does not call showModal", () => {
      render(<HotkeysDialog open={false} onClose={() => {}} hotkeys={sampleHotkeys} />)
      expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()
    })
  })

  describe("closing behavior", () => {
    it("calls onClose when the Close button is clicked", () => {
      const handleClose = vi.fn()
      render(<HotkeysDialog open={true} onClose={handleClose} hotkeys={sampleHotkeys} />)
      fireEvent.click(screen.getByText("Close"))
      expect(handleClose).toHaveBeenCalledOnce()
    })
  })

  describe("empty hotkeys", () => {
    it("renders the dialog with no hotkey rows when the list is empty", () => {
      const { container } = render(
        <HotkeysDialog open={true} onClose={() => {}} hotkeys={[]} />,
      )
      expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
      const kbdElements = container.querySelectorAll("kbd")
      expect(kbdElements).toHaveLength(0)
    })
  })
})
