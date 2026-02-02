import { describe, it, expect } from "vitest"
import { findClaudeExecutable } from ".././findClaudeExecutable.js"

describe("findClaudeExecutable", () => {
  it("can be imported and called", () => {
    // findClaudeExecutable checks for Claude CLI in common locations.
    // The result depends on the environment, so we just verify it returns
    // either a string path or undefined.
    const result = findClaudeExecutable()
    expect(result === undefined || typeof result === "string").toBe(true)
  })

  it("returns a string path if Claude is installed, or undefined if not", () => {
    const result = findClaudeExecutable()
    if (result !== undefined) {
      // If found, it should be an absolute path
      expect(result.startsWith("/")).toBe(true)
    }
  })
})
