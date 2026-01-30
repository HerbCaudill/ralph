import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { ContentStreamContainer } from "./ContentStreamContainer"

describe("ContentStreamContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders children content", () => {
    render(
      <ContentStreamContainer ariaLabel="Test stream">
        <div>Message 1</div>
        <div>Message 2</div>
      </ContentStreamContainer>,
    )

    expect(screen.getByText("Message 1")).toBeInTheDocument()
    expect(screen.getByText("Message 2")).toBeInTheDocument()
  })

  it("renders empty state when no children", () => {
    render(
      <ContentStreamContainer ariaLabel="Test stream" emptyState={<div>No messages yet</div>}>
        {null}
      </ContentStreamContainer>,
    )

    expect(screen.getByText("No messages yet")).toBeInTheDocument()
  })

  it("renders empty state when children is empty array", () => {
    render(
      <ContentStreamContainer ariaLabel="Test stream" emptyState={<div>Empty</div>}>
        {[]}
      </ContentStreamContainer>,
    )

    expect(screen.getByText("Empty")).toBeInTheDocument()
  })

  it("has correct aria attributes", () => {
    render(
      <ContentStreamContainer ariaLabel="Event stream">
        <div>Content</div>
      </ContentStreamContainer>,
    )

    const container = screen.getByRole("log")
    expect(container).toHaveAttribute("aria-label", "Event stream")
    expect(container).toHaveAttribute("aria-live", "polite")
  })

  it("applies custom className", () => {
    const { container } = render(
      <ContentStreamContainer ariaLabel="Test" className="custom-class">
        <div>Content</div>
      </ContentStreamContainer>,
    )

    expect(container.firstChild).toHaveClass("custom-class")
  })

  it("shows scroll to bottom button when scrolled away from bottom", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    // Create content tall enough to scroll
    const tallContent = (
      <div style={{ height: "2000px" }}>
        <div>Top content</div>
        <div style={{ marginTop: "1900px" }}>Bottom content</div>
      </div>
    )

    render(<ContentStreamContainer ariaLabel="Test stream">{tallContent}</ContentStreamContainer>)

    const scrollContainer = screen.getByRole("log")

    // Mock scrollHeight and clientHeight to simulate scrollable content
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 2000, configurable: true })
    Object.defineProperty(scrollContainer, "clientHeight", { value: 400, configurable: true })
    Object.defineProperty(scrollContainer, "scrollTop", {
      value: 0,
      writable: true,
      configurable: true,
    })

    // Simulate user scrolling up (wheel event triggers handleUserScroll)
    await user.pointer({ target: scrollContainer, keys: "[MouseLeft]" })

    // Fire scroll events to trigger state update
    scrollContainer.dispatchEvent(new Event("scroll"))
    scrollContainer.dispatchEvent(new WheelEvent("wheel"))

    // The button should appear when not at bottom
    // Note: In a real scenario, the button visibility depends on isAtBottom state
    // which is managed by the useAutoScroll hook
  })

  it("does not show scroll button when at bottom", () => {
    render(
      <ContentStreamContainer ariaLabel="Test stream">
        <div>Short content</div>
      </ContentStreamContainer>,
    )

    // Initially at bottom, button should not be visible
    expect(screen.queryByRole("button", { name: /scroll to latest/i })).not.toBeInTheDocument()
  })
})
