import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, afterEach } from "vitest"
import { ScrollToBottomButton } from "../ScrollToBottomButton"

describe("ScrollToBottomButton", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders nothing when isVisible is false", () => {
    const onClick = vi.fn()
    const { container } = render(<ScrollToBottomButton isVisible={false} onClick={onClick} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a button when isVisible is true", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("displays 'Latest' text", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />)
    expect(screen.getByText("Latest")).toBeInTheDocument()
  })

  it("uses default aria-label", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Scroll to latest")
  })

  it("uses custom aria-label when provided", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} ariaLabel="Custom label" />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Custom label")
  })

  it("calls onClick when clicked", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />)
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("applies custom className", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} className="custom-class" />)
    expect(screen.getByRole("button")).toHaveClass("custom-class")
  })

  it("uses the Button component (has data-slot='button')", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />)
    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("data-slot", "button")
  })

  it("retains rounded-full styling for pill shape", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />)
    const button = screen.getByRole("button")
    expect(button.className).toContain("rounded-full")
  })
})
