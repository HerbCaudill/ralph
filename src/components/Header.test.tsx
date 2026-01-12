import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "ink-testing-library"
import { Header } from "./Header.js"

describe("Header", () => {
  it("renders the title", () => {
    const { lastFrame } = render(<Header version="1.0.0" />)
    const output = lastFrame()
    // BigText renders ASCII art with ANSI codes
    // Check for box-drawing characters or unicode that appear in the art
    expect(output.length).toBeGreaterThan(0)
    expect(output).toContain("Claude Code")
  })

  it("displays the version number", () => {
    const { lastFrame } = render(<Header version="2.5.3" />)
    const output = lastFrame()
    expect(output).toContain("v2.5.3")
  })

  it("displays Claude Code prefix with version", () => {
    const { lastFrame } = render(<Header version="1.0.0" />)
    const output = lastFrame()
    expect(output).toContain("Claude Code v1.0.0")
  })
})
