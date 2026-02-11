import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { resolveWorkspacePath } from "../resolveWorkspacePath.js"
import * as beadsSdk from "@herbcaudill/beads-sdk"

// Mock getAliveWorkspaces from the SDK
vi.mock("@herbcaudill/beads-sdk", async importOriginal => {
  const original = (await importOriginal()) as typeof beadsSdk
  return {
    ...original,
    getAliveWorkspaces: vi.fn(),
  }
})

const mockGetAliveWorkspaces = vi.mocked(beadsSdk.getAliveWorkspaces)

describe("resolveWorkspacePath", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("absolute path input", () => {
    it("returns the path as-is when it starts with /", () => {
      const result = resolveWorkspacePath("/Users/herbcaudill/Code/HerbCaudill/ralph")
      expect(result).toBe("/Users/herbcaudill/Code/HerbCaudill/ralph")
    })

    it("does not call getAliveWorkspaces for absolute paths", () => {
      resolveWorkspacePath("/some/absolute/path")
      expect(mockGetAliveWorkspaces).not.toHaveBeenCalled()
    })
  })

  describe("workspace ID input (owner/repo format)", () => {
    it("resolves workspace ID to path when workspace is alive", () => {
      mockGetAliveWorkspaces.mockReturnValue([
        {
          path: "/Users/herbcaudill/Code/HerbCaudill/ralph",
          name: "ralph",
          database: "/path/to/db",
          pid: 12345,
          version: "1.0.0",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ])

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBe("/Users/herbcaudill/Code/HerbCaudill/ralph")
    })

    it("handles case-insensitive matching", () => {
      mockGetAliveWorkspaces.mockReturnValue([
        {
          path: "/Users/herbcaudill/Code/HerbCaudill/Ralph",
          name: "Ralph",
          database: "/path/to/db",
          pid: 12345,
          version: "1.0.0",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ])

      const result = resolveWorkspacePath("HerbCaudill/Ralph")
      expect(result).toBe("/Users/herbcaudill/Code/HerbCaudill/Ralph")
    })

    it("returns null when no alive workspaces match", () => {
      mockGetAliveWorkspaces.mockReturnValue([
        {
          path: "/Users/herbcaudill/Code/SomeOrg/other-project",
          name: "other-project",
          database: "/path/to/db",
          pid: 12345,
          version: "1.0.0",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ])

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBeNull()
    })

    it("returns null when no workspaces are alive", () => {
      mockGetAliveWorkspaces.mockReturnValue([])

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBeNull()
    })

    it("resolves worktree paths when workspace is alive", () => {
      mockGetAliveWorkspaces.mockReturnValue([
        {
          path: "/Users/herbcaudill/.ralph-worktrees/feature-abc123",
          name: "feature-abc123",
          database: "/path/to/db",
          pid: 12345,
          version: "1.0.0",
          startedAt: "2024-01-01T00:00:00Z",
        },
      ])

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBeNull()
    })
  })
})
