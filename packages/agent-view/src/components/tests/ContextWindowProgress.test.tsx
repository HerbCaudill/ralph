import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { ContextWindowProgress } from "../ContextWindowProgress"

describe("ContextWindowProgress", () => {
  it("returns null when used is 0", () => {
    const { container } = render(<ContextWindowProgress contextWindow={{ used: 0, max: 200000 }} />)
    expect(container.firstChild).toBeNull()
  })

  it("displays percentage instead of raw token count", () => {
    render(<ContextWindowProgress contextWindow={{ used: 50000, max: 200000 }} />)

    // Should show "25%" (50000/200000 = 25%)
    expect(screen.getByText("25%")).toBeInTheDocument()

    // Should NOT show raw token count like "50.0k"
    expect(screen.queryByText("50.0k")).not.toBeInTheDocument()
  })

  it("rounds the percentage to the nearest integer", () => {
    render(<ContextWindowProgress contextWindow={{ used: 73000, max: 200000 }} />)

    // 73000/200000 = 36.5%, rounds to 37%
    expect(screen.getByText("37%")).toBeInTheDocument()
  })

  it("keeps full token details in the tooltip", () => {
    render(<ContextWindowProgress contextWindow={{ used: 50000, max: 200000 }} />)

    const container = screen.getByTestId("context-window-progress")
    expect(container.getAttribute("title")).toContain("50.0k")
    expect(container.getAttribute("title")).toContain("200.0k")
    expect(container.getAttribute("title")).toContain("25.0%")
  })

  it("shows correct color for low usage", () => {
    const { container } = render(
      <ContextWindowProgress contextWindow={{ used: 20000, max: 200000 }} />,
    )

    // 10% usage should be green (success)
    const bar = container.querySelector("[class*='bg-status-success']")
    expect(bar).toBeInTheDocument()
  })

  it("shows warning color at 50% usage", () => {
    const { container } = render(
      <ContextWindowProgress contextWindow={{ used: 100000, max: 200000 }} />,
    )

    const bar = container.querySelector("[class*='bg-status-warning']")
    expect(bar).toBeInTheDocument()
  })

  it("shows error color at 80% usage", () => {
    const { container } = render(
      <ContextWindowProgress contextWindow={{ used: 160000, max: 200000 }} />,
    )

    const bar = container.querySelector("[class*='bg-status-error']")
    expect(bar).toBeInTheDocument()
  })
})
