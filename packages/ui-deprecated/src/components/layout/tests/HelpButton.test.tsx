import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { HelpButton } from ".././HelpButton"
import { useAppStore } from "@/store"

describe("HelpButton", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  it("renders with correct aria-label", () => {
    render(<HelpButton />)
    expect(screen.getByRole("button", { name: "Keyboard shortcuts" })).toBeInTheDocument()
  })

  it("has correct data-testid", () => {
    render(<HelpButton />)
    expect(screen.getByTestId("help-button")).toBeInTheDocument()
  })

  it("opens hotkeys dialog when clicked", () => {
    render(<HelpButton />)

    // Dialog should be closed initially
    expect(useAppStore.getState().hotkeysDialogOpen).toBe(false)

    // Click the button
    fireEvent.click(screen.getByTestId("help-button"))

    // Dialog should now be open
    expect(useAppStore.getState().hotkeysDialogOpen).toBe(true)
  })

  it("applies custom textColor style", () => {
    render(<HelpButton textColor="#ff0000" />)
    const button = screen.getByTestId("help-button")
    expect(button).toHaveStyle({ color: "#ff0000" })
  })

  it("applies custom className", () => {
    render(<HelpButton className="custom-class" />)
    const button = screen.getByTestId("help-button")
    expect(button).toHaveClass("custom-class")
  })
})
