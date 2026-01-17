import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "ink-testing-library"
import { ProgressBar } from "./ProgressBar.js"

describe("ProgressBar", () => {
  it("renders nothing when total is 0", () => {
    const { lastFrame } = render(<ProgressBar remaining={0} total={0} />)
    expect(lastFrame()).toBe("")
  })

  it("shows 0% when all tasks remain", () => {
    const { lastFrame } = render(<ProgressBar remaining={10} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("0%")
    expect(output).toContain("░░░░░░░░░░")
  })

  it("shows 100% when no tasks remain", () => {
    const { lastFrame } = render(<ProgressBar remaining={0} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("100%")
    expect(output).toContain("██████████")
  })

  it("shows 50% when half remain", () => {
    const { lastFrame } = render(<ProgressBar remaining={5} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("50%")
    expect(output).toContain("█████")
    expect(output).toContain("░░░░░")
  })

  it("respects custom width", () => {
    const { lastFrame } = render(<ProgressBar remaining={0} total={10} width={5} />)
    const output = lastFrame()!
    // Should have 5 filled blocks
    expect(output).toMatch(/█{5}/)
  })

  it("clamps progress to 0-100%", () => {
    // More remaining than total (shouldn't happen, but handle gracefully)
    const { lastFrame } = render(<ProgressBar remaining={15} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("0%")
  })
})
