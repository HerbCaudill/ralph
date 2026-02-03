import { describe, it, expect } from "vitest"
import { getRepoName } from "../getRepoName"

describe("getRepoName", () => {
  it("returns null for null input", () => {
    expect(getRepoName(null)).toBe(null)
  })

  it("returns the last path segment for a simple path", () => {
    expect(getRepoName("/Users/test/my-project")).toBe("my-project")
  })

  it("returns the project name for a worktree path", () => {
    // Worktree paths have the format: {parent}/{project}-worktrees/{instanceName}-{instanceId}
    expect(getRepoName("/Users/test/my-project-worktrees/alice-abc123")).toBe("my-project")
  })

  it("returns the project name for a worktree with hyphenated project name", () => {
    expect(getRepoName("/Users/test/my-awesome-project-worktrees/bob-def456")).toBe(
      "my-awesome-project",
    )
  })

  it("handles root paths correctly", () => {
    expect(getRepoName("/project")).toBe("project")
  })

  it("handles paths without leading slash", () => {
    expect(getRepoName("project")).toBe("project")
  })

  it("handles empty string", () => {
    expect(getRepoName("")).toBe(null)
  })

  it("handles worktrees at root level", () => {
    expect(getRepoName("/project-worktrees/alice-abc123")).toBe("project")
  })
})
