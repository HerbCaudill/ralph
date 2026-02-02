import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "ink-testing-library"
import { ProgressBar } from ".././ProgressBar.js"

describe("ProgressBar", () => {
  it("renders nothing when total is 0", () => {
    const { lastFrame } = render(<ProgressBar completed={0} total={0} />)
    expect(lastFrame()).toBe("")
  })

  it("shows empty bar when no tasks completed", () => {
    const { lastFrame } = render(<ProgressBar completed={0} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("▱▱▱▱▱▱▱▱▱▱")
    expect(output).toContain("0/10")
  })

  it("shows full bar when all tasks completed", () => {
    const { lastFrame } = render(<ProgressBar completed={10} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("▰▰▰▰▰▰▰▰▰▰")
    expect(output).toContain("10/10")
  })

  it("shows half bar when half completed", () => {
    const { lastFrame } = render(<ProgressBar completed={5} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("▰▰▰▰▰")
    expect(output).toContain("▱▱▱▱▱")
    expect(output).toContain("5/10")
  })

  it("respects custom width", () => {
    const { lastFrame } = render(<ProgressBar completed={10} total={10} width={5} />)
    const output = lastFrame()!
    // Should have 5 filled blocks
    expect(output).toMatch(/▰{5}/)
  })

  it("clamps progress to 0-100%", () => {
    // More completed than total (shouldn't happen, but handle gracefully)
    const { lastFrame } = render(<ProgressBar completed={15} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).toContain("▰▰▰▰▰▰▰▰▰▰")
  })

  it("displays repo name when provided", () => {
    const { lastFrame } = render(
      <ProgressBar completed={5} total={10} width={10} repoName="my-repo" />,
    )
    const output = lastFrame()!
    expect(output).toContain("my-repo")
    expect(output).toContain("│")
    expect(output).toContain("5/10")
  })

  it("does not display repo name when not provided", () => {
    const { lastFrame } = render(<ProgressBar completed={5} total={10} width={10} />)
    const output = lastFrame()!
    expect(output).not.toContain("│")
    expect(output).toContain("5/10")
  })
})
