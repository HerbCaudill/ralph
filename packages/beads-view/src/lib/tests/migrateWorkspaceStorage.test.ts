import { describe, it, expect, beforeEach, vi } from "vitest"
import { migrateWorkspaceStorage } from "../migrateWorkspaceStorage"

describe("migrateWorkspaceStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("converts a filesystem path to a workspace ID", () => {
    localStorage.setItem("ralph-workspace-path", "/Users/herbcaudill/Code/HerbCaudill/ralph")
    migrateWorkspaceStorage()
    expect(localStorage.getItem("ralph-workspace-path")).toBe("herbcaudill/ralph")
  })

  it("does not modify values that are already workspace IDs", () => {
    localStorage.setItem("ralph-workspace-path", "herbcaudill/ralph")
    migrateWorkspaceStorage()
    expect(localStorage.getItem("ralph-workspace-path")).toBe("herbcaudill/ralph")
  })

  it("is idempotent — second call is a no-op", () => {
    localStorage.setItem("ralph-workspace-path", "/Users/herbcaudill/Code/HerbCaudill/ralph")
    migrateWorkspaceStorage()
    // Manually set back to a path to prove migration won't run again
    localStorage.setItem("ralph-workspace-path", "/some/other/path")
    migrateWorkspaceStorage()
    expect(localStorage.getItem("ralph-workspace-path")).toBe("/some/other/path")
  })

  it("handles missing stored value", () => {
    migrateWorkspaceStorage()
    expect(localStorage.getItem("ralph-workspace-path")).toBeNull()
  })

  it("supports custom storage key", () => {
    localStorage.setItem("custom-key", "/Users/test/Code/MyOrg/project")
    migrateWorkspaceStorage("custom-key")
    expect(localStorage.getItem("custom-key")).toBe("myorg/project")
  })

  it("lowercases the workspace ID", () => {
    localStorage.setItem("ralph-workspace-path", "/Users/test/Code/HerbCaudill/Ralph")
    migrateWorkspaceStorage()
    expect(localStorage.getItem("ralph-workspace-path")).toBe("herbcaudill/ralph")
  })
})
