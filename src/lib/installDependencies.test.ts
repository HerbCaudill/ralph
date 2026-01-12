import { describe, it, expect, vi, beforeEach } from "vitest"
import { installDependencies } from "./installDependencies.js"
import { execSync } from "child_process"
import { existsSync } from "fs"

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}))

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}))

describe("installDependencies", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("runs pnpm install when package.json exists", () => {
    vi.mocked(existsSync).mockReturnValue(true)

    installDependencies("/tmp/worktree")

    expect(execSync).toHaveBeenCalledWith("pnpm install", {
      encoding: "utf-8",
      stdio: "pipe",
      cwd: "/tmp/worktree",
    })
  })

  it("does nothing when package.json does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false)

    installDependencies("/tmp/worktree")

    expect(execSync).not.toHaveBeenCalled()
  })

  it("throws error when pnpm install fails", () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("pnpm not found")
    })

    expect(() => installDependencies("/tmp/worktree")).toThrow(
      "Failed to install dependencies: Error: pnpm not found",
    )
  })
})
