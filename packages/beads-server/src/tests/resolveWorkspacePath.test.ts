import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { resolveWorkspacePath } from "../resolveWorkspacePath.js"
import * as beadsSdkNode from "@herbcaudill/beads-sdk/node"
import * as fs from "node:fs"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

// Mock getAliveWorkspaces from the SDK node entry point
vi.mock("@herbcaudill/beads-sdk/node", async importOriginal => {
  const original = (await importOriginal()) as typeof beadsSdkNode
  return {
    ...original,
    getAliveWorkspaces: vi.fn(),
  }
})

vi.mock("node:fs", async importOriginal => {
  const original = (await importOriginal()) as typeof fs
  return {
    ...original,
    existsSync: vi.fn(original.existsSync),
  }
})

const mockGetAliveWorkspaces = vi.mocked(beadsSdkNode.getAliveWorkspaces)
const mockExistsSync = vi.mocked(fs.existsSync)

describe("resolveWorkspacePath", () => {
  const originalEnv = process.env.WORKSPACE_PATH
  let tempDir: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.WORKSPACE_PATH
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (originalEnv !== undefined) {
      process.env.WORKSPACE_PATH = originalEnv
    } else {
      delete process.env.WORKSPACE_PATH
    }
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true })
      tempDir = undefined
    }
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

  describe("WORKSPACE_PATH fallback", () => {
    it("resolves from WORKSPACE_PATH when registry is empty", () => {
      mockGetAliveWorkspaces.mockReturnValue([])
      process.env.WORKSPACE_PATH = "/Users/herbcaudill/Code/HerbCaudill/ralph"
      mockExistsSync.mockReturnValue(true)

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBe("/Users/herbcaudill/Code/HerbCaudill/ralph")
    })

    it("returns null when WORKSPACE_PATH does not match requested ID", () => {
      mockGetAliveWorkspaces.mockReturnValue([])
      process.env.WORKSPACE_PATH = "/Users/herbcaudill/Code/SomeOrg/other-project"
      mockExistsSync.mockReturnValue(true)

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBeNull()
    })

    it("returns null when WORKSPACE_PATH has no .beads directory", () => {
      mockGetAliveWorkspaces.mockReturnValue([])
      process.env.WORKSPACE_PATH = "/Users/herbcaudill/Code/HerbCaudill/ralph"
      mockExistsSync.mockReturnValue(false)

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBeNull()
    })

    it("returns null when WORKSPACE_PATH is not set", () => {
      mockGetAliveWorkspaces.mockReturnValue([])
      delete process.env.WORKSPACE_PATH

      const result = resolveWorkspacePath("herbcaudill/ralph")
      expect(result).toBeNull()
    })

    it("resolves sibling Beads workspaces by workspace ID", async () => {
      tempDir = await mkdtemp(join(tmpdir(), "beads-workspaces-"))
      const currentWorkspace = join(tempDir, "ralph")
      const siblingWorkspace = join(tempDir, "dotfiles")
      await mkdir(join(currentWorkspace, ".beads"), { recursive: true })
      await mkdir(join(siblingWorkspace, ".beads"), { recursive: true })
      mockGetAliveWorkspaces.mockReturnValue([])
      mockExistsSync.mockImplementation(target => target.toString().endsWith(".beads"))
      process.env.WORKSPACE_PATH = currentWorkspace

      const result = resolveWorkspacePath(`${tempDir.split("/").pop()}/dotfiles`.toLowerCase())
      expect(result).toBe(siblingWorkspace)
    })
  })
})
