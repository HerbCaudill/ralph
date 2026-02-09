import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { HotkeysDialog } from "../HotkeysDialog"

describe("HotkeysDialog", () => {
  it("renders when open", () => {
    render(<HotkeysDialog open={true} onClose={() => {}} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("does not render when closed", () => {
    render(<HotkeysDialog open={false} onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("displays keyboard shortcuts title", () => {
    render(<HotkeysDialog open={true} onClose={() => {}} />)
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument()
  })

  it("calls onClose when Close button is clicked", () => {
    const handleClose = vi.fn()
    render(<HotkeysDialog open={true} onClose={handleClose} />)

    const closeButtons = screen.getAllByRole("button", { name: "Close" })
    const closeButton = closeButtons.find((button) => button.getAttribute("data-variant") === "secondary")
    expect(closeButton).toBeDefined()
    fireEvent.click(closeButton!)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("has dialog styles applied to the content", () => {
    render(<HotkeysDialog open={true} onClose={() => {}} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.className).toContain("max-w-lg")
  })
})
