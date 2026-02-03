import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { InstanceCountBadge } from ".././InstanceCountBadge"

describe("InstanceCountBadge", () => {
  it("renders the count", () => {
    render(<InstanceCountBadge count={3} />)
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("displays tooltip with instance count", () => {
    render(<InstanceCountBadge count={5} />)
    const badge = screen.getByTestId("instance-count-badge")
    expect(badge).toHaveAttribute("title", "5 instances running")
  })

  it("applies custom className", () => {
    render(<InstanceCountBadge count={2} className="custom-class" />)
    const badge = screen.getByTestId("instance-count-badge")
    expect(badge).toHaveClass("custom-class")
  })

  it("has the pulse indicator", () => {
    render(<InstanceCountBadge count={2} />)
    const badge = screen.getByTestId("instance-count-badge")
    const indicator = badge.querySelector(".animate-pulse")
    expect(indicator).toBeInTheDocument()
  })
})
