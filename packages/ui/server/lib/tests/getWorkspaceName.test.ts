import { describe, it, expect } from "vitest"
import { getWorkspaceName } from "../getWorkspaceName.js"

describe("getWorkspaceName", () => {
  it("returns the last path segment for a simple path", () => {
    expect(getWorkspaceName("/Users/test/my-project")).toBe("my-project")
  })

  it("returns the project name for a worktree path", () => {
    // Worktree paths have the format: {parent}/{project}-worktrees/{instanceName}-{instanceId}
    expect(getWorkspaceName("/Users/test/my-project-worktrees/alice-abc123")).toBe("my-project")
  })

  it("returns the project name for a worktree with hyphenated project name", () => {
    expect(getWorkspaceName("/Users/test/my-awesome-project-worktrees/bob-def456")).toBe(
      "my-awesome-project",
    )
  })

  it("handles root paths correctly", () => {
    expect(getWorkspaceName("/project")).toBe("project")
  })

  it("handles paths without leading slash", () => {
    expect(getWorkspaceName("project")).toBe("project")
  })

  it("handles worktrees at root level", () => {
    expect(getWorkspaceName("/project-worktrees/alice-abc123")).toBe("project")
  })
})
