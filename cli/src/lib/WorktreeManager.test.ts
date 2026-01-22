import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { WorktreeManager } from "./WorktreeManager.js"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "node:child_process"

/**
 * Run a git command in the specified directory and return its stdout.
 * Rejects with an error if the command fails.
 */
function git(
  /** Working directory for the git command */
  cwd: string,
  /** Git command arguments (e.g., ["add", "."]) */
  args: string[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", data => {
      stdout += data.toString()
    })

    proc.stderr.on("data", data => {
      stderr += data.toString()
    })

    proc.on("close", code => {
      if (code === 0) {
        resolve(stdout.trim())
      } else {
        reject(new Error(stderr.trim() || `git ${args[0]} failed with code ${code}`))
      }
    })
  })
}

describe("WorktreeManager", () => {
  const testDir = join(process.cwd(), ".test-worktrees")
  const mainWorkspacePath = join(testDir, "project")
  const worktreesPath = join(testDir, "project-worktrees")
  let manager: WorktreeManager

  beforeEach(async () => {
    // Clean up any existing test directories
    try {
      await rm(testDir, { recursive: true })
    } catch {
      // Ignore if doesn't exist
    }

    // Create test directory structure
    await mkdir(mainWorkspacePath, { recursive: true })

    // Initialize a git repo
    await git(mainWorkspacePath, ["init"])
    await git(mainWorkspacePath, ["config", "user.email", "test@test.com"])
    await git(mainWorkspacePath, ["config", "user.name", "Test User"])

    // Create an initial commit (required for worktrees)
    await writeFile(join(mainWorkspacePath, "README.md"), "# Test Project")
    await git(mainWorkspacePath, ["add", "."])
    await git(mainWorkspacePath, ["commit", "-m", "Initial commit"])

    manager = new WorktreeManager(mainWorkspacePath)
  })

  afterEach(async () => {
    // Clean up test directories
    try {
      // First prune any worktrees
      await git(mainWorkspacePath, ["worktree", "prune"])
    } catch {
      // Ignore
    }

    try {
      await rm(testDir, { recursive: true })
    } catch {
      // Ignore
    }
  })

  describe("constructor", () => {
    it("sets worktrees base path in sibling folder", () => {
      expect(manager.getWorktreesBasePath()).toBe(worktreesPath)
    })
  })

  describe("getWorktreePath", () => {
    it("returns correct path for instance", () => {
      const path = manager.getWorktreePath("abc123", "alice")
      expect(path).toBe(join(worktreesPath, "alice-abc123"))
    })
  })

  describe("getBranchName", () => {
    it("returns correct branch name for instance", () => {
      const branch = manager.getBranchName("abc123", "alice")
      expect(branch).toBe("ralph/alice-abc123")
    })
  })

  describe("create", () => {
    it("creates a worktree with new branch", async () => {
      const result = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      expect(result.path).toBe(join(worktreesPath, "alice-abc123"))
      expect(result.branch).toBe("ralph/alice-abc123")
      expect(result.instanceId).toBe("abc123")
      expect(result.instanceName).toBe("alice")

      // Verify worktree exists
      const worktreeList = await git(mainWorkspacePath, ["worktree", "list"])
      expect(worktreeList).toContain("alice-abc123")

      // Verify branch exists
      const branches = await git(mainWorkspacePath, ["branch", "-a"])
      expect(branches).toContain("ralph/alice-abc123")
    })

    it("creates worktrees directory if it doesn't exist", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Worktrees directory should exist
      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(true)
    })
  })

  describe("exists", () => {
    it("returns false for non-existent worktree", async () => {
      const exists = await manager.exists("nonexistent", "fake")
      expect(exists).toBe(false)
    })

    it("returns true for existing worktree", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(true)
    })
  })

  describe("list", () => {
    it("returns empty array when no ralph worktrees exist", async () => {
      const worktrees = await manager.list()
      expect(worktrees).toEqual([])
    })

    it("returns list of ralph worktrees", async () => {
      await manager.create({ instanceId: "abc123", instanceName: "alice" })
      await manager.create({ instanceId: "def456", instanceName: "bob" })

      const worktrees = await manager.list()

      expect(worktrees).toHaveLength(2)
      expect(worktrees).toContainEqual(
        expect.objectContaining({
          instanceId: "abc123",
          instanceName: "alice",
          branch: "ralph/alice-abc123",
        }),
      )
      expect(worktrees).toContainEqual(
        expect.objectContaining({
          instanceId: "def456",
          instanceName: "bob",
          branch: "ralph/bob-def456",
        }),
      )
    })
  })

  describe("remove", () => {
    it("removes worktree and branch", async () => {
      await manager.create({ instanceId: "abc123", instanceName: "alice" })

      await manager.remove("abc123", "alice")

      // Worktree should be gone
      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(false)

      // Branch should be gone
      const branches = await git(mainWorkspacePath, ["branch", "-a"])
      expect(branches).not.toContain("ralph/alice-abc123")
    })

    it("removes worktree but keeps branch when deleteBranch is false", async () => {
      await manager.create({ instanceId: "abc123", instanceName: "alice" })

      await manager.remove("abc123", "alice", false)

      // Worktree should be gone
      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(false)

      // Branch should still exist
      const branches = await git(mainWorkspacePath, ["branch", "-a"])
      expect(branches).toContain("ralph/alice-abc123")
    })

    it("succeeds even if worktree doesn't exist", async () => {
      // Should not throw
      await manager.remove("nonexistent", "fake")
    })
  })

  describe("merge", () => {
    it("merges worktree branch to main", async () => {
      // Create worktree
      const worktree = await manager.create({ instanceId: "abc123", instanceName: "alice" })

      // Make a change in the worktree
      await writeFile(join(worktree.path, "feature.txt"), "new feature")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add feature"])

      // Merge back to main
      const result = await manager.merge("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.hadConflicts).toBe(false)

      // Verify merge happened (we should be back on main with the changes)
      const currentBranch = await git(mainWorkspacePath, ["rev-parse", "--abbrev-ref", "HEAD"])
      expect(currentBranch).toMatch(/^(main|master)$/)
    })

    it("reports conflicts when they occur", async () => {
      // Create worktree
      const worktree = await manager.create({ instanceId: "abc123", instanceName: "alice" })

      // Make conflicting changes in main
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])

      // Make conflicting changes in worktree
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Attempt merge
      const result = await manager.merge("abc123", "alice")

      expect(result.success).toBe(false)
      expect(result.hadConflicts).toBe(true)

      // Clean up merge state
      await git(mainWorkspacePath, ["merge", "--abort"])
    })
  })

  describe("rebase", () => {
    it("rebases worktree branch on main", async () => {
      // Create worktree
      const worktree = await manager.create({ instanceId: "abc123", instanceName: "alice" })

      // Make a change in main
      await writeFile(join(mainWorkspacePath, "main-change.txt"), "main change")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add main change"])

      // Make a change in the worktree
      await writeFile(join(worktree.path, "feature.txt"), "new feature")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add feature"])

      // Rebase worktree on main
      const result = await manager.rebase("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.hadConflicts).toBe(false)
    })

    it("reports conflicts when they occur", async () => {
      // Create worktree
      const worktree = await manager.create({ instanceId: "abc123", instanceName: "alice" })

      // Make conflicting changes in main
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])

      // Make conflicting changes in worktree
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Attempt rebase
      const result = await manager.rebase("abc123", "alice")

      expect(result.success).toBe(false)
      expect(result.hadConflicts).toBe(true)
    })
  })

  describe("prune", () => {
    it("prunes stale worktree entries", async () => {
      // This mainly verifies the command doesn't error
      await manager.prune()
    })
  })
})
