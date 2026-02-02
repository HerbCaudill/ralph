import { describe, it, expect } from "vitest"
import { WorktreeManager } from "./WorktreeManager.js"

describe("WorktreeManager", () => {
  it("can be instantiated", () => {
    const wm = new WorktreeManager("/tmp/my-project")
    expect(wm).toBeInstanceOf(WorktreeManager)
  })

  it("returns the main workspace path", () => {
    const wm = new WorktreeManager("/tmp/my-project")
    expect(wm.getMainWorkspacePath()).toBe("/tmp/my-project")
  })

  it("computes the worktrees base path as a sibling directory", () => {
    const wm = new WorktreeManager("/tmp/my-project")
    expect(wm.getWorktreesBasePath()).toBe("/tmp/my-project-worktrees")
  })

  it("computes worktree path for an instance", () => {
    const wm = new WorktreeManager("/tmp/my-project")
    const path = wm.getWorktreePath("abc123", "alice")
    expect(path).toBe("/tmp/my-project-worktrees/alice-abc123")
  })

  it("computes branch name for an instance", () => {
    const wm = new WorktreeManager("/tmp/my-project")
    const branch = wm.getBranchName("abc123", "alice")
    expect(branch).toBe("ralph/alice-abc123")
  })

  it("handles workspace path with trailing segments correctly", () => {
    const wm = new WorktreeManager("/home/user/projects/cool-app")
    expect(wm.getWorktreesBasePath()).toBe("/home/user/projects/cool-app-worktrees")
    expect(wm.getWorktreePath("id1", "bot")).toBe("/home/user/projects/cool-app-worktrees/bot-id1")
    expect(wm.getBranchName("id1", "bot")).toBe("ralph/bot-id1")
  })
})
