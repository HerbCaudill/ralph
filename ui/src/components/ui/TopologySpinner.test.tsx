import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { TopologySpinner } from "./TopologySpinner"

describe("TopologySpinner", () => {
  it("renders an icon", () => {
    render(<TopologySpinner />)
    const svg = document.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("has the animate-spin-pulse class", () => {
    render(<TopologySpinner />)
    const svg = document.querySelector("svg")
    expect(svg).toHaveClass("animate-spin-pulse")
  })

  it("applies custom className", () => {
    render(<TopologySpinner className="custom-class" />)
    const svg = document.querySelector("svg")
    expect(svg).toHaveClass("custom-class")
  })

  it("applies duration as inline style", () => {
    render(<TopologySpinner duration={500} />)
    const svg = document.querySelector("svg")
    expect(svg).toHaveStyle({ animationDuration: "500ms" })
  })

  it("uses default duration of 1000ms", () => {
    render(<TopologySpinner />)
    const svg = document.querySelector("svg")
    expect(svg).toHaveStyle({ animationDuration: "1000ms" })
  })

  it("changes icon on animation iteration", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0) // initial icon index 0
      .mockReturnValueOnce(0.5) // next icon will be different

    const { container } = render(<TopologySpinner />)
    const initialIcon = container.querySelector("svg")?.innerHTML

    // Simulate animation iteration
    const svg = container.querySelector("svg")!
    fireEvent.animationIteration(svg)

    const nextIcon = container.querySelector("svg")?.innerHTML
    expect(nextIcon).not.toBe(initialIcon)

    vi.restoreAllMocks()
  })

  it("always picks a different icon on iteration", () => {
    // Mock random to return same index repeatedly, forcing the retry logic
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1) // initial: index 0
      .mockReturnValueOnce(0.1) // first try: same index, should retry
      .mockReturnValueOnce(0.5) // second try: different index

    const { container } = render(<TopologySpinner />)
    const initialIcon = container.querySelector("svg")?.innerHTML

    const svg = container.querySelector("svg")!
    fireEvent.animationIteration(svg)

    const nextIcon = container.querySelector("svg")?.innerHTML
    expect(nextIcon).not.toBe(initialIcon)

    vi.restoreAllMocks()
  })

  it("is hidden from assistive technology", () => {
    render(<TopologySpinner />)
    const svg = document.querySelector("svg")
    expect(svg).toHaveAttribute("aria-hidden", "true")
  })
})
