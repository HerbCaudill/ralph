import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "ink-testing-library"
import { ToolUse } from ".././ToolUse.js"

describe("ToolUse", () => {
  it("renders tool name only when no arg provided", () => {
    const { lastFrame } = render(<ToolUse name="Read" />)
    const output = lastFrame()
    expect(output).toContain("Read")
  })

  it("renders tool name and arg when arg provided", () => {
    const { lastFrame } = render(<ToolUse name="Read" arg="src/index.ts" />)
    const output = lastFrame()
    expect(output).toContain("Read")
    expect(output).toContain("src/index.ts")
  })

  it("renders Bash command with $ symbol", () => {
    const { lastFrame } = render(<ToolUse name="$" arg="npm test" />)
    const output = lastFrame()
    expect(output).toContain("$")
    expect(output).toContain("npm test")
  })

  it("renders TodoWrite with formatted list", () => {
    const { lastFrame } = render(
      <ToolUse name="TodoWrite" arg={"\n    [ ] Task 1\n    [x] Task 2"} />,
    )
    const output = lastFrame()
    expect(output).toContain("TodoWrite")
    expect(output).toContain("Task 1")
    expect(output).toContain("Task 2")
  })

  it("renders Grep with pattern", () => {
    const { lastFrame } = render(<ToolUse name="Grep" arg="TODO in src" />)
    const output = lastFrame()
    expect(output).toContain("Grep")
    expect(output).toContain("TODO in src")
  })

  it("renders Glob with pattern", () => {
    const { lastFrame } = render(<ToolUse name="Glob" arg="**/*.ts" />)
    const output = lastFrame()
    expect(output).toContain("Glob")
    expect(output).toContain("**/*.ts")
  })
})
