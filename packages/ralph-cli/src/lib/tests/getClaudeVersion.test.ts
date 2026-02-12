import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { execSync } from "child_process"
import { getClaudeVersion } from ".././getClaudeVersion.js"

vi.mock("child_process")

describe("getClaudeVersion", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should extract version from standard output", () => {
    vi.mocked(execSync).mockReturnValue("2.1.5 (Claude Code)\n")
    expect(getClaudeVersion()).toBe("2.1.5")
  })

  it("should handle version without Claude Code suffix", () => {
    vi.mocked(execSync).mockReturnValue("1.0.0\n")
    expect(getClaudeVersion()).toBe("1.0.0")
  })

  it("should extract version with extra whitespace", () => {
    vi.mocked(execSync).mockReturnValue("  3.2.1 (Claude Code)  \n")
    expect(getClaudeVersion()).toBe("3.2.1")
  })

  it("should return unknown if claude command fails", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("Command not found")
    })
    expect(getClaudeVersion()).toBe("unknown")
  })

  it("should return unknown if output format is unexpected", () => {
    vi.mocked(execSync).mockReturnValue("Invalid output format")
    expect(getClaudeVersion()).toBe("unknown")
  })

  it("should handle empty output", () => {
    vi.mocked(execSync).mockReturnValue("")
    expect(getClaudeVersion()).toBe("unknown")
  })
})
