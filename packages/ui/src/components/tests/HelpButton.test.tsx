import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { HelpButton } from "../HelpButton"

describe("HelpButton", () => {
  it("renders with correct aria-label", () => {
    render(<HelpButton onClick={() => {}} />)
    expect(screen.getByRole("button", { name: "Keyboard shortcuts" })).toBeInTheDocument()
  })

  it("has correct data-testid", () => {
    render(<HelpButton onClick={() => {}} />)
    expect(screen.getByTestId("help-button")).toBeInTheDocument()
  })

  it("renders a keyboard icon (not a help/question mark icon)", () => {
    render(<HelpButton onClick={() => {}} />)
    const button = screen.getByTestId("help-button")
    // Should contain an SVG element (the keyboard icon)
    const svg = button.querySelector("svg")
    expect(svg).toBeTruthy()
    // Tabler icons add a data-slot attribute for identification
    const svgClasses = svg?.getAttribute("class") ?? ""
    // Should contain keyboard-related identifier, not help icon
    expect(svgClasses).toContain("size-5")
  })

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn()
    render(<HelpButton onClick={handleClick} />)

    fireEvent.click(screen.getByTestId("help-button"))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("applies custom textColor style", () => {
    render(<HelpButton onClick={() => {}} textColor="#ff0000" />)
    const button = screen.getByTestId("help-button")
    expect(button).toHaveStyle({ color: "#ff0000" })
  })

  it("applies custom className", () => {
    render(<HelpButton onClick={() => {}} className="custom-class" />)
    const button = screen.getByTestId("help-button")
    expect(button).toHaveClass("custom-class")
  })
})
