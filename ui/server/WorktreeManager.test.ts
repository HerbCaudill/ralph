import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { WorktreeManager, type WorktreeInfo } from "./WorktreeManager.js"
import { mkdtemp, rm, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"

/**
 * Helper to run git commands in a directory.
 */
function git(cwd: string, args: string[]): Promise<string> {
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
        reject(new Error(stderr || `git ${args[0]} failed with code ${code}`))
      }
    })
  })
}

describe("WorktreeManager", () => {
  let tempDir: string
  let mainWorkspace: string
  let manager: WorktreeManager

  beforeEach(async () => {
    // Create a temp directory for tests
    tempDir = await mkdtemp(join(tmpdir(), "worktree-test-"))
    mainWorkspace = join(tempDir, "test-project")

    // Initialize a git repo
    await mkdir(mainWorkspace, { recursive: true })
    await git(mainWorkspace, ["init"])
    await git(mainWorkspace, ["config", "user.email", "test@test.com"])
    await git(mainWorkspace, ["config", "user.name", "Test User"])

    // Create an initial commit (required for worktrees)
    await git(mainWorkspace, ["commit", "--allow-empty", "-m", "Initial commit"])

    manager = new WorktreeManager(mainWorkspace)
  })

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("constructor", () => {
    it("sets the main workspace path", () => {
      expect(manager.getMainWorkspacePath()).toBe(mainWorkspace)
    })

    it("calculates worktrees base path as sibling folder", () => {
      expect(manager.getWorktreesBasePath()).toBe(join(tempDir, "test-project-worktrees"))
    })
  })

  describe("getWorktreePath", () => {
    it("returns path in worktrees directory with name and id", () => {
      const path = manager.getWorktreePath("abc123", "alice")
      expect(path).toBe(join(tempDir, "test-project-worktrees", "alice-abc123"))
    })
  })

  describe("getBranchName", () => {
    it("returns branch name with ralph prefix", () => {
      const branch = manager.getBranchName("abc123", "alice")
      expect(branch).toBe("ralph/alice-abc123")
    })
  })

  describe("create", () => {
    it("creates a worktree with correct path and branch", async () => {
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      expect(info.path).toBe(join(tempDir, "test-project-worktrees", "alice-abc123"))
      expect(info.branch).toBe("ralph/alice-abc123")
      expect(info.instanceId).toBe("abc123")
      expect(info.instanceName).toBe("alice")
    })

    it("creates the worktrees base directory if it doesn't exist", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(true)
    })

    it("creates a new git branch for the worktree", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Check that the branch exists
      const branches = await git(mainWorkspace, ["branch", "-a"])
      expect(branches).toContain("ralph/alice-abc123")
    })
  })

  describe("exists", () => {
    it("returns false when worktree does not exist", async () => {
      const exists = await manager.exists("nonexistent", "test")
      expect(exists).toBe(false)
    })

    it("returns true when worktree exists", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(true)
    })
  })

  describe("list", () => {
    it("returns empty array when no worktrees exist", async () => {
      const worktrees = await manager.list()
      expect(worktrees).toEqual([])
    })

    it("returns worktrees created by this manager", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })
      await manager.create({
        instanceId: "def456",
        instanceName: "bob",
      })

      const worktrees = await manager.list()

      expect(worktrees).toHaveLength(2)

      const alice = worktrees.find(w => w.instanceId === "abc123")
      expect(alice).toBeDefined()
      expect(alice!.instanceName).toBe("alice")
      expect(alice!.branch).toBe("ralph/alice-abc123")

      const bob = worktrees.find(w => w.instanceId === "def456")
      expect(bob).toBeDefined()
      expect(bob!.instanceName).toBe("bob")
      expect(bob!.branch).toBe("ralph/bob-def456")
    })
  })

  describe("remove", () => {
    it("removes the worktree directory", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      await manager.remove("abc123", "alice")

      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(false)
    })

    it("deletes the branch by default", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      await manager.remove("abc123", "alice")

      const branches = await git(mainWorkspace, ["branch", "-a"])
      expect(branches).not.toContain("ralph/alice-abc123")
    })

    it("keeps the branch when deleteBranch is false", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      await manager.remove("abc123", "alice", false)

      const branches = await git(mainWorkspace, ["branch", "-a"])
      expect(branches).toContain("ralph/alice-abc123")
    })

    it("does not throw when worktree does not exist", async () => {
      await expect(manager.remove("nonexistent", "test")).resolves.toBeUndefined()
    })
  })

  describe("prune", () => {
    it("does not throw when called", async () => {
      await expect(manager.prune()).resolves.toBeUndefined()
    })
  })

  describe("merge", () => {
    it("merges worktree branch to main", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a commit in the worktree
      await git(info.path, ["commit", "--allow-empty", "-m", "Work from alice"])

      // Merge it back
      const result = await manager.merge("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.hadConflicts).toBe(false)
      expect(result.message).toContain("Successfully merged")
    })

    it("detects merge conflicts", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a conflicting change in main
      await git(mainWorkspace, ["checkout", "main"])
      await git(mainWorkspace, ["commit", "--allow-empty", "-m", "Work from main"])

      // Make a commit in the worktree with the same file
      // First we need to create a file conflict
      const { writeFile } = await import("node:fs/promises")
      await writeFile(join(mainWorkspace, "test.txt"), "main content")
      await git(mainWorkspace, ["add", "test.txt"])
      await git(mainWorkspace, ["commit", "-m", "Add test.txt from main"])

      await writeFile(join(info.path, "test.txt"), "alice content")
      await git(info.path, ["add", "test.txt"])
      await git(info.path, ["commit", "-m", "Add test.txt from alice"])

      // Try to merge it back
      const result = await manager.merge("abc123", "alice")

      expect(result.success).toBe(false)
      expect(result.hadConflicts).toBe(true)

      // Clean up the merge state
      await git(mainWorkspace, ["merge", "--abort"])
    })
  })

  describe("rebase", () => {
    it("rebases worktree branch on main", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a commit in main (main workspace is already on main)
      await git(mainWorkspace, ["commit", "--allow-empty", "-m", "Work from main"])

      // Rebase the worktree (the worktree is on its branch, we rebase it on main)
      const result = await manager.rebase("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.hadConflicts).toBe(false)
    })

    it("detects rebase conflicts", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a conflicting change in main
      const { writeFile } = await import("node:fs/promises")
      await git(mainWorkspace, ["checkout", "main"])
      await writeFile(join(mainWorkspace, "conflict.txt"), "main content")
      await git(mainWorkspace, ["add", "conflict.txt"])
      await git(mainWorkspace, ["commit", "-m", "Add conflict.txt from main"])

      // Make a conflicting commit in the worktree
      await writeFile(join(info.path, "conflict.txt"), "alice content")
      await git(info.path, ["add", "conflict.txt"])
      await git(info.path, ["commit", "-m", "Add conflict.txt from alice"])

      // Try to rebase
      const result = await manager.rebase("abc123", "alice")

      expect(result.success).toBe(false)
      expect(result.hadConflicts).toBe(true)
    })
  })

  describe("postIterationMerge", () => {
    it("successfully merges and rebases when no conflicts", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a commit in the worktree
      await git(info.path, ["commit", "--allow-empty", "-m", "Work from alice"])

      // Run post-iteration merge
      const result = await manager.postIterationMerge("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.merge.success).toBe(true)
      expect(result.merge.hadConflicts).toBe(false)
      expect(result.rebase).not.toBeNull()
      expect(result.rebase!.success).toBe(true)
      expect(result.message).toContain("Successfully merged")
    })

    it("returns merge conflicts and does not attempt rebase", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a conflicting change in main
      const { writeFile } = await import("node:fs/promises")
      await git(mainWorkspace, ["checkout", "main"])
      await writeFile(join(mainWorkspace, "conflict.txt"), "main content")
      await git(mainWorkspace, ["add", "conflict.txt"])
      await git(mainWorkspace, ["commit", "-m", "Add conflict.txt from main"])

      // Make a conflicting commit in the worktree
      await writeFile(join(info.path, "conflict.txt"), "alice content")
      await git(info.path, ["add", "conflict.txt"])
      await git(info.path, ["commit", "-m", "Add conflict.txt from alice"])

      // Run post-iteration merge
      const result = await manager.postIterationMerge("abc123", "alice")

      expect(result.success).toBe(false)
      expect(result.merge.success).toBe(false)
      expect(result.merge.hadConflicts).toBe(true)
      expect(result.rebase).toBeNull() // Rebase not attempted
      expect(result.message).toContain("conflicts")

      // Clean up the merge state
      await git(mainWorkspace, ["merge", "--abort"])
    })

    it("handles non-conflicting divergent branches", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a commit in the worktree with a unique file
      const { writeFile } = await import("node:fs/promises")
      await writeFile(join(info.path, "alice.txt"), "alice content")
      await git(info.path, ["add", "alice.txt"])
      await git(info.path, ["commit", "-m", "Alice's work"])

      // Make a commit in main AFTER the worktree was created with a different file
      await git(mainWorkspace, ["checkout", "main"])
      await writeFile(join(mainWorkspace, "main.txt"), "main content")
      await git(mainWorkspace, ["add", "main.txt"])
      await git(mainWorkspace, ["commit", "-m", "Main commit"])

      // Run post-iteration merge
      // 1. Merge alice's branch to main - should succeed (no conflicts, different files)
      // 2. Rebase the worktree on main - should succeed
      const result = await manager.postIterationMerge("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.merge.success).toBe(true)
      expect(result.merge.hadConflicts).toBe(false)
      expect(result.rebase).not.toBeNull()
      expect(result.rebase!.success).toBe(true)
      expect(result.message).toContain("Successfully merged")
    })
  })

  describe("validate", () => {
    it("returns valid status for existing worktree", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      const status = await manager.validate("abc123", "alice")

      expect(status.directoryExists).toBe(true)
      expect(status.gitRegistered).toBe(true)
      expect(status.branchExists).toBe(true)
      expect(status.isValid).toBe(true)
      expect(status.message).toBe("Worktree is valid and ready")
    })

    it("returns invalid status for non-existent worktree", async () => {
      const status = await manager.validate("nonexistent", "test")

      expect(status.directoryExists).toBe(false)
      expect(status.gitRegistered).toBe(false)
      expect(status.branchExists).toBe(false)
      expect(status.isValid).toBe(false)
      expect(status.message).toBe("Worktree does not exist")
    })

    it("detects externally deleted worktree directory", async () => {
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Externally delete the directory (simulating manual deletion)
      await rm(info.path, { recursive: true, force: true })

      const status = await manager.validate("abc123", "alice")

      expect(status.directoryExists).toBe(false)
      expect(status.gitRegistered).toBe(true) // Git still knows about it
      expect(status.branchExists).toBe(true) // Branch still exists
      expect(status.isValid).toBe(false)
      expect(status.message).toContain("externally deleted")
    })

    it("detects missing branch", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Remove the worktree and delete the branch
      await manager.remove("abc123", "alice", true)

      const status = await manager.validate("abc123", "alice")

      expect(status.branchExists).toBe(false)
      expect(status.isValid).toBe(false)
    })
  })

  describe("recreate", () => {
    it("recreates worktree after external deletion (branch exists)", async () => {
      const originalInfo = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a commit so we can verify it's preserved
      await git(originalInfo.path, ["commit", "--allow-empty", "-m", "Alice's work"])

      // Externally delete the directory
      await rm(originalInfo.path, { recursive: true, force: true })

      // Recreate the worktree
      const newInfo = await manager.recreate("abc123", "alice")

      expect(newInfo.path).toBe(originalInfo.path)
      expect(newInfo.branch).toBe(originalInfo.branch)

      // Verify it's valid now
      const status = await manager.validate("abc123", "alice")
      expect(status.isValid).toBe(true)

      // Verify the commit is still there (branch was preserved)
      const log = await git(newInfo.path, ["log", "--oneline"])
      expect(log).toContain("Alice's work")
    })

    it("recreates worktree with new branch if branch was deleted", async () => {
      const originalInfo = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Remove the worktree AND delete the branch
      await manager.remove("abc123", "alice", true)

      // Recreate the worktree (will create new branch)
      const newInfo = await manager.recreate("abc123", "alice")

      expect(newInfo.path).toBe(originalInfo.path)
      expect(newInfo.branch).toBe(originalInfo.branch)

      // Verify it's valid now
      const status = await manager.validate("abc123", "alice")
      expect(status.isValid).toBe(true)
    })

    it("throws if worktree is already valid", async () => {
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      await expect(manager.recreate("abc123", "alice")).rejects.toThrow("already valid")
    })
  })

  describe("cleanup", () => {
    it("merges commits and removes worktree when there are unmerged commits", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a commit in the worktree
      await git(info.path, ["commit", "--allow-empty", "-m", "Work from alice"])

      // Run cleanup
      const result = await manager.cleanup("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.merge).not.toBeNull()
      expect(result.merge!.success).toBe(true)
      expect(result.removed).toBe(true)
      expect(result.message).toContain("Merged")
      expect(result.message).toContain("Removed")

      // Verify worktree is gone
      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(false)

      // Verify branch is gone
      const branches = await git(mainWorkspace, ["branch", "-a"])
      expect(branches).not.toContain("ralph/alice-abc123")

      // Verify the commit made it to main
      const log = await git(mainWorkspace, ["log", "--oneline"])
      expect(log).toContain("Work from alice")
    })

    it("removes worktree without merge when there are no commits", async () => {
      // Create a worktree (no commits made)
      await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Run cleanup
      const result = await manager.cleanup("abc123", "alice")

      expect(result.success).toBe(true)
      expect(result.merge).toBeNull() // No merge needed
      expect(result.removed).toBe(true)
      expect(result.message).toContain("No commits to merge")
      expect(result.message).toContain("Removed")

      // Verify worktree is gone
      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(false)
    })

    it("fails with merge conflicts and does not remove worktree", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a conflicting change in main
      const { writeFile } = await import("node:fs/promises")
      await git(mainWorkspace, ["checkout", "main"])
      await writeFile(join(mainWorkspace, "conflict.txt"), "main content")
      await git(mainWorkspace, ["add", "conflict.txt"])
      await git(mainWorkspace, ["commit", "-m", "Add conflict.txt from main"])

      // Make a conflicting commit in the worktree
      await writeFile(join(info.path, "conflict.txt"), "alice content")
      await git(info.path, ["add", "conflict.txt"])
      await git(info.path, ["commit", "-m", "Add conflict.txt from alice"])

      // Run cleanup
      const result = await manager.cleanup("abc123", "alice")

      expect(result.success).toBe(false)
      expect(result.merge).not.toBeNull()
      expect(result.merge!.success).toBe(false)
      expect(result.merge!.hadConflicts).toBe(true)
      expect(result.removed).toBe(false)
      expect(result.message).toContain("conflicts")

      // Verify worktree still exists
      const exists = await manager.exists("abc123", "alice")
      expect(exists).toBe(true)

      // Verify branch still exists
      const branches = await git(mainWorkspace, ["branch", "-a"])
      expect(branches).toContain("ralph/alice-abc123")

      // Clean up the merge state
      await git(mainWorkspace, ["merge", "--abort"])
    })

    it("handles non-existent worktree gracefully", async () => {
      // Try to cleanup a worktree that doesn't exist
      const result = await manager.cleanup("nonexistent", "test")

      expect(result.success).toBe(true)
      expect(result.merge).toBeNull()
      expect(result.removed).toBe(true)
      expect(result.message).toContain("No commits to merge")
    })

    it("preserves main branch state after successful cleanup", async () => {
      // Create a worktree
      const info = await manager.create({
        instanceId: "abc123",
        instanceName: "alice",
      })

      // Make a commit in the worktree
      const { writeFile } = await import("node:fs/promises")
      await writeFile(join(info.path, "alice.txt"), "alice's work")
      await git(info.path, ["add", "alice.txt"])
      await git(info.path, ["commit", "-m", "Alice's changes"])

      // Run cleanup
      const result = await manager.cleanup("abc123", "alice")

      expect(result.success).toBe(true)

      // Verify we're on main after cleanup
      const currentBranch = await git(mainWorkspace, ["rev-parse", "--abbrev-ref", "HEAD"])
      expect(currentBranch).toBe("main")

      // Verify the file from alice's work is now on main
      const { readFile } = await import("node:fs/promises")
      const content = await readFile(join(mainWorkspace, "alice.txt"), "utf-8")
      expect(content).toBe("alice's work")
    })
  })
})
