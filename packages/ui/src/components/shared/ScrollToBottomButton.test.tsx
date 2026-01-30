import { render, screen, cleanup } from "@testing-library/react"
import { vi, describe, it, expect, afterEach } from "vitest"
import { ScrollToBottomButton } from "./ScrollToBottomButton"

describe("ScrollToBottomButton", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders nothing when isVisible is false", () => {
    const onClick = vi.fn()
    const { container } = render(<ScrollToBottomButton isVisible={false} onClick={onClick} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders button when isVisible is true", () => {
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

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn()
    const { user } = await import("@testing-library/user-event").then(m => ({
      user: m.default.setup(),
    }))
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />)
    await user.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("applies custom className", () => {
    const onClick = vi.fn()
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} className="custom-class" />)
    expect(screen.getByRole("button")).toHaveClass("custom-class")
  })
})
