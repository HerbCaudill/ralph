import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll } from "vitest"
import { HotkeysDialog } from "../HotkeysDialog"

// Mock dialog.showModal() and dialog.close() for jsdom
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "")
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open")
  })
})

describe("HotkeysDialog", () => {
  it("renders when open", () => {
    render(<HotkeysDialog open={true} onClose={() => {}} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("does not show modal when closed", () => {
    render(<HotkeysDialog open={false} onClose={() => {}} />)
    const dialog = screen.getByRole("dialog", { hidden: true })
    expect(dialog).not.toHaveAttribute("open")
  })

  it("displays keyboard shortcuts title", () => {
    render(<HotkeysDialog open={true} onClose={() => {}} />)
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument()
  })

  it("calls onClose when Close button is clicked", () => {
    const handleClose = vi.fn()
    render(<HotkeysDialog open={true} onClose={handleClose} />)

    fireEvent.click(screen.getByText("Close"))

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("has centering styles applied to dialog", () => {
    render(<HotkeysDialog open={true} onClose={() => {}} />)
    const dialog = screen.getByRole("dialog")
    // The dialog should have margin auto to center it both horizontally and vertically
    expect(dialog.className).toContain("m-auto")
  })
})
