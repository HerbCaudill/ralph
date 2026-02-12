import { describe, it, expect } from "vitest"
import { getWorkspaceId } from "../getWorkspaceId.js"

describe("getWorkspaceId", () => {
  describe("from git remote URLs", () => {
    it("extracts owner/repo from HTTPS GitHub URL", () => {
      expect(getWorkspaceId({ gitRemoteUrl: "https://github.com/herbcaudill/ralph.git" })).toBe(
        "herbcaudill/ralph",
      )
    })

    it("extracts owner/repo from HTTPS GitHub URL without .git", () => {
      expect(getWorkspaceId({ gitRemoteUrl: "https://github.com/herbcaudill/ralph" })).toBe(
        "herbcaudill/ralph",
      )
    })

    it("extracts owner/repo from SSH GitHub URL", () => {
      expect(getWorkspaceId({ gitRemoteUrl: "git@github.com:herbcaudill/ralph.git" })).toBe(
        "herbcaudill/ralph",
      )
    })

    it("extracts owner/repo from SSH GitHub URL without .git", () => {
      expect(getWorkspaceId({ gitRemoteUrl: "git@github.com:herbcaudill/ralph" })).toBe(
        "herbcaudill/ralph",
      )
    })

    it("extracts owner/repo from GitLab HTTPS URL", () => {
      expect(getWorkspaceId({ gitRemoteUrl: "https://gitlab.com/myorg/myproject.git" })).toBe(
        "myorg/myproject",
      )
    })

    it("extracts owner/repo from GitLab SSH URL", () => {
      expect(getWorkspaceId({ gitRemoteUrl: "git@gitlab.com:myorg/myproject.git" })).toBe(
        "myorg/myproject",
      )
    })

    it("handles nested groups in GitLab URLs", () => {
      expect(
        getWorkspaceId({ gitRemoteUrl: "https://gitlab.com/org/group/subgroup/project.git" }),
      ).toBe("org/project")
    })

    it("lowercases the result", () => {
      expect(getWorkspaceId({ gitRemoteUrl: "https://github.com/HerbCaudill/Ralph.git" })).toBe(
        "herbcaudill/ralph",
      )
    })
  })

  describe("fallback to filesystem path", () => {
    it("uses last two segments of path as fallback", () => {
      expect(getWorkspaceId({ workspacePath: "/Users/herbcaudill/Code/HerbCaudill/ralph" })).toBe(
        "herbcaudill/ralph",
      )
    })

    it("lowercases path segments", () => {
      expect(getWorkspaceId({ workspacePath: "/Users/herbcaudill/Code/HerbCaudill/Ralph" })).toBe(
        "herbcaudill/ralph",
      )
    })

    it("handles short paths", () => {
      expect(getWorkspaceId({ workspacePath: "/project" })).toBe("project")
    })

    it("handles worktree paths", () => {
      expect(
        getWorkspaceId({
          workspacePath: "/Users/test/.ralph-worktrees/feature-abc123",
          gitRemoteUrl: "https://github.com/herbcaudill/ralph.git",
        }),
      ).toBe("herbcaudill/ralph")
    })
  })

  describe("prefers git remote over path", () => {
    it("uses git remote when both are provided", () => {
      expect(
        getWorkspaceId({
          gitRemoteUrl: "https://github.com/herbcaudill/ralph.git",
          workspacePath: "/some/other/path",
        }),
      ).toBe("herbcaudill/ralph")
    })

    it("falls back to path when git remote is empty", () => {
      expect(
        getWorkspaceId({
          gitRemoteUrl: "",
          workspacePath: "/Users/herbcaudill/Code/HerbCaudill/ralph",
        }),
      ).toBe("herbcaudill/ralph")
    })
  })
})
