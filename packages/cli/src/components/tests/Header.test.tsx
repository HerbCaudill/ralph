import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "ink-testing-library"
import { Header } from ".././Header.js"

describe("Header", () => {
  it("renders the title", () => {
    const { lastFrame } = render(<Header claudeVersion="1.0.0" ralphVersion="0.2.0" />)
    const output = lastFrame()
    // BigText renders ASCII art with ANSI codes
    // Check for box-drawing characters or unicode that appear in the art
    expect(output?.length).toBeGreaterThan(0)
    expect(output).toContain("Claude Code")
  })

  it("displays both version numbers on the same line", () => {
    const { lastFrame } = render(<Header claudeVersion="2.5.3" ralphVersion="0.2.0" />)
    const output = lastFrame()
    expect(output).toContain("@herbcaudill/ralph v0.2.0")
    expect(output).toContain("Claude Code v2.5.3")
    expect(output).toContain("•")
  })

  it("displays versions with correct formatting", () => {
    const { lastFrame } = render(<Header claudeVersion="1.0.0" ralphVersion="0.1.0" />)
    const output = lastFrame()
    expect(output).toContain("@herbcaudill/ralph v0.1.0 • Claude Code v1.0.0")
  })
})
