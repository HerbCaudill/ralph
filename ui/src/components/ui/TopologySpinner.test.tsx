import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, act } from "@testing-library/react"
import { TopologySpinner } from "./TopologySpinner"

describe("TopologySpinner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders an icon", () => {
    render(<TopologySpinner />)
    // The SVG is hidden from assistive tech but should be present
    const svg = document.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("has the animate-spin class", () => {
    render(<TopologySpinner />)
    const svg = document.querySelector("svg")
    expect(svg).toHaveClass("animate-spin")
  })

  it("applies custom className", () => {
    render(<TopologySpinner className="custom-class" />)
    const svg = document.querySelector("svg")
    expect(svg).toHaveClass("custom-class")
  })

  it("cycles through icons at the specified interval", () => {
    const { container } = render(<TopologySpinner interval={100} />)

    // Get initial icon
    const initialIcon = container.querySelector("svg")?.innerHTML

    // Advance timer by one interval
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Icon should have changed
    const nextIcon = container.querySelector("svg")?.innerHTML
    expect(nextIcon).not.toBe(initialIcon)
  })

  it("cycles back to first icon after all icons", () => {
    const { container } = render(<TopologySpinner interval={100} />)

    // Get initial icon
    const initialIcon = container.querySelector("svg")?.innerHTML

    // Advance through all 6 icons
    act(() => {
      vi.advanceTimersByTime(600)
    })

    // Should be back to initial icon
    const cycledIcon = container.querySelector("svg")?.innerHTML
    expect(cycledIcon).toBe(initialIcon)
  })

  it("uses default interval of 300ms", () => {
    const { container } = render(<TopologySpinner />)
    const initialIcon = container.querySelector("svg")?.innerHTML

    // Advance by less than default interval
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(container.querySelector("svg")?.innerHTML).toBe(initialIcon)

    // Advance past default interval
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(container.querySelector("svg")?.innerHTML).not.toBe(initialIcon)
  })

  it("cleans up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval")
    const { unmount } = render(<TopologySpinner />)

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
