import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { WorktreeManager } from "../WorktreeManager.js"
import { mkdir, rm, writeFile, readFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"

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
  const testDir = join(process.cwd(), ".test-worktrees-agent-server")
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
    it("returns correct path for worker and task", () => {
      const path = manager.getWorktreePath("homer", "bd-abc123")
      expect(path).toBe(join(worktreesPath, "homer", "bd-abc123"))
    })
  })

  describe("getBranchName", () => {
    it("returns correct branch name with worker and task", () => {
      const branch = manager.getBranchName("homer", "bd-abc123")
      expect(branch).toBe("ralph/homer/bd-abc123")
    })
  })

  describe("create", () => {
    it("creates a worktree with new branch", async () => {
      const result = await manager.create({
        workerName: "homer",
        taskId: "bd-abc123",
      })

      expect(result.path).toBe(join(worktreesPath, "homer", "bd-abc123"))
      expect(result.branch).toBe("ralph/homer/bd-abc123")
      expect(result.workerName).toBe("homer")
      expect(result.taskId).toBe("bd-abc123")

      // Verify worktree exists
      const worktreeList = await git(mainWorkspacePath, ["worktree", "list"])
      expect(worktreeList).toContain("bd-abc123")

      // Verify branch exists
      const branches = await git(mainWorkspacePath, ["branch", "-a"])
      expect(branches).toContain("ralph/homer/bd-abc123")
    })

    it("creates nested worktrees directory if it doesn't exist", async () => {
      await manager.create({
        workerName: "homer",
        taskId: "bd-abc123",
      })

      // Worktrees directory should exist
      const exists = await manager.exists("homer", "bd-abc123")
      expect(exists).toBe(true)
    })

    it("pulls latest main before creating worktree", async () => {
      // Create a bare remote repo
      const remoteDir = join(testDir, "remote.git")
      await mkdir(remoteDir, { recursive: true })
      await git(remoteDir, ["init", "--bare"])

      // Add remote to main workspace
      await git(mainWorkspacePath, ["remote", "add", "origin", remoteDir])
      await git(mainWorkspacePath, ["push", "-u", "origin", "main"])

      // Create another clone to simulate a remote change
      const otherClone = join(testDir, "other-clone")
      await git(testDir, ["clone", remoteDir, "other-clone"])
      await git(otherClone, ["config", "user.email", "test@test.com"])
      await git(otherClone, ["config", "user.name", "Test User"])
      await writeFile(join(otherClone, "remote-change.txt"), "remote change")
      await git(otherClone, ["add", "."])
      await git(otherClone, ["commit", "-m", "Add remote change"])
      await git(otherClone, ["push"])

      // Create worktree - should pull latest first
      const result = await manager.create({
        workerName: "homer",
        taskId: "bd-abc123",
      })

      // Verify the worktree has the remote change
      const remoteFileExists = existsSync(join(result.path, "remote-change.txt"))
      expect(remoteFileExists).toBe(true)
    })
  })

  describe("exists", () => {
    it("returns false for non-existent worktree", async () => {
      const exists = await manager.exists("nonexistent", "fake-task")
      expect(exists).toBe(false)
    })

    it("returns true for existing worktree", async () => {
      await manager.create({
        workerName: "homer",
        taskId: "bd-abc123",
      })

      const exists = await manager.exists("homer", "bd-abc123")
      expect(exists).toBe(true)
    })
  })

  describe("list", () => {
    it("returns empty array when no ralph worktrees exist", async () => {
      const worktrees = await manager.list()
      expect(worktrees).toEqual([])
    })

    it("returns list of ralph worktrees", async () => {
      await manager.create({ workerName: "homer", taskId: "bd-abc123" })
      await manager.create({ workerName: "marge", taskId: "bd-def456" })

      const worktrees = await manager.list()

      expect(worktrees).toHaveLength(2)
      expect(worktrees).toContainEqual(
        expect.objectContaining({
          workerName: "homer",
          taskId: "bd-abc123",
          branch: "ralph/homer/bd-abc123",
        }),
      )
      expect(worktrees).toContainEqual(
        expect.objectContaining({
          workerName: "marge",
          taskId: "bd-def456",
          branch: "ralph/marge/bd-def456",
        }),
      )
    })

    it("returns worktrees for a specific worker", async () => {
      await manager.create({ workerName: "homer", taskId: "bd-abc123" })
      await manager.create({ workerName: "marge", taskId: "bd-def456" })
      await manager.create({ workerName: "homer", taskId: "bd-ghi789" })

      const worktrees = await manager.list("homer")

      expect(worktrees).toHaveLength(2)
      expect(worktrees.every(wt => wt.workerName === "homer")).toBe(true)
    })
  })

  describe("remove", () => {
    it("removes worktree and branch", async () => {
      await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      await manager.remove("homer", "bd-abc123")

      // Worktree should be gone
      const exists = await manager.exists("homer", "bd-abc123")
      expect(exists).toBe(false)

      // Branch should be gone
      const branches = await git(mainWorkspacePath, ["branch", "-a"])
      expect(branches).not.toContain("ralph/homer/bd-abc123")
    })

    it("removes worktree but keeps branch when deleteBranch is false", async () => {
      await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      await manager.remove("homer", "bd-abc123", { deleteBranch: false })

      // Worktree should be gone
      const exists = await manager.exists("homer", "bd-abc123")
      expect(exists).toBe(false)

      // Branch should still exist
      const branches = await git(mainWorkspacePath, ["branch", "-a"])
      expect(branches).toContain("ralph/homer/bd-abc123")
    })

    it("succeeds even if worktree doesn't exist", async () => {
      // Should not throw
      await manager.remove("nonexistent", "fake-task")
    })
  })

  describe("merge", () => {
    it("merges worktree branch to main", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make a change in the worktree
      await writeFile(join(worktree.path, "feature.txt"), "new feature")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add feature"])

      // Merge back to main
      const result = await manager.merge("homer", "bd-abc123")

      expect(result.success).toBe(true)
      expect(result.hadConflicts).toBe(false)

      // Verify merge happened (we should be back on main with the changes)
      const currentBranch = await git(mainWorkspacePath, ["rev-parse", "--abbrev-ref", "HEAD"])
      expect(currentBranch).toMatch(/^(main|master)$/)

      // Verify the file exists in main
      const content = await readFile(join(mainWorkspacePath, "feature.txt"), "utf-8")
      expect(content).toBe("new feature")
    })

    it("reports conflicts when they occur", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make conflicting changes in main
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])

      // Make conflicting changes in worktree
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Attempt merge
      const result = await manager.merge("homer", "bd-abc123")

      expect(result.success).toBe(false)
      expect(result.hadConflicts).toBe(true)

      // Clean up merge state
      await git(mainWorkspacePath, ["merge", "--abort"])
    })
  })

  describe("cleanup", () => {
    it("removes worktree and branch after successful merge", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make a change in the worktree
      await writeFile(join(worktree.path, "feature.txt"), "new feature")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add feature"])

      // Cleanup (merge + remove)
      const result = await manager.cleanup("homer", "bd-abc123")

      expect(result.success).toBe(true)
      expect(result.merged).toBe(true)
      expect(result.removed).toBe(true)

      // Worktree should be gone
      const exists = await manager.exists("homer", "bd-abc123")
      expect(exists).toBe(false)

      // Branch should be gone
      const branches = await git(mainWorkspacePath, ["branch", "-a"])
      expect(branches).not.toContain("ralph/homer/bd-abc123")
    })

    it("does not remove worktree on merge conflict", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make conflicting changes in main
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])

      // Make conflicting changes in worktree
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Attempt cleanup - should fail on merge
      const result = await manager.cleanup("homer", "bd-abc123")

      expect(result.success).toBe(false)
      expect(result.merged).toBe(false)
      expect(result.removed).toBe(false)
      expect(result.hadConflicts).toBe(true)

      // Worktree should still exist
      const exists = await manager.exists("homer", "bd-abc123")
      expect(exists).toBe(true)

      // Clean up merge state
      await git(mainWorkspacePath, ["merge", "--abort"])
    })
  })

  describe("conflict resolution", () => {
    it("getConflictingFiles returns empty when no merge in progress", async () => {
      const conflicts = await manager.getConflictingFiles()
      expect(conflicts).toEqual([])
    })

    it("isMergeInProgress returns false when no merge in progress", async () => {
      const inProgress = await manager.isMergeInProgress()
      expect(inProgress).toBe(false)
    })

    it("detects conflicting files during merge", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make conflicting changes in main
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])

      // Make conflicting changes in worktree
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Attempt merge (will fail with conflicts)
      await manager.merge("homer", "bd-abc123")

      // Check merge state
      const inProgress = await manager.isMergeInProgress()
      expect(inProgress).toBe(true)

      // Get conflicting files
      const conflicts = await manager.getConflictingFiles()
      expect(conflicts).toContain("conflict.txt")

      // Clean up
      await manager.abortMerge()
    })

    it("can abort a merge in progress", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make conflicting changes
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Start merge (will fail with conflicts)
      await manager.merge("homer", "bd-abc123")
      expect(await manager.isMergeInProgress()).toBe(true)

      // Abort merge
      await manager.abortMerge()
      expect(await manager.isMergeInProgress()).toBe(false)
    })

    it("can complete a merge after resolving conflicts", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make conflicting changes
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Start merge (will fail with conflicts)
      await manager.merge("homer", "bd-abc123")

      // Resolve the conflict (choose worktree version)
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "resolved version")
      await git(mainWorkspacePath, ["add", "conflict.txt"])

      // Complete merge
      const result = await manager.completeMerge("homer", "bd-abc123")
      expect(result.success).toBe(true)
      expect(await manager.isMergeInProgress()).toBe(false)

      // Verify the resolved content
      const content = await readFile(join(mainWorkspacePath, "conflict.txt"), "utf-8")
      expect(content).toBe("resolved version")
    })

    it("completeMerge fails if conflicts remain", async () => {
      // Create worktree
      const worktree = await manager.create({ workerName: "homer", taskId: "bd-abc123" })

      // Make conflicting changes
      await writeFile(join(mainWorkspacePath, "conflict.txt"), "main version")
      await git(mainWorkspacePath, ["add", "."])
      await git(mainWorkspacePath, ["commit", "-m", "Add conflict file on main"])
      await writeFile(join(worktree.path, "conflict.txt"), "worktree version")
      await git(worktree.path, ["add", "."])
      await git(worktree.path, ["commit", "-m", "Add conflict file in worktree"])

      // Start merge (will fail with conflicts)
      await manager.merge("homer", "bd-abc123")

      // Try to complete without resolving
      const result = await manager.completeMerge("homer", "bd-abc123")
      expect(result.success).toBe(false)
      expect(result.hadConflicts).toBe(true)

      // Clean up
      await manager.abortMerge()
    })
  })

  describe("prune", () => {
    it("prunes stale worktree entries", async () => {
      // This mainly verifies the command doesn't error
      await manager.prune()
    })
  })

  describe("pullLatest", () => {
    it("pulls latest changes from remote", async () => {
      // Create a bare remote repo
      const remoteDir = join(testDir, "remote.git")
      await mkdir(remoteDir, { recursive: true })
      await git(remoteDir, ["init", "--bare"])

      // Add remote to main workspace
      await git(mainWorkspacePath, ["remote", "add", "origin", remoteDir])
      await git(mainWorkspacePath, ["push", "-u", "origin", "main"])

      // Create another clone to simulate a remote change
      const otherClone = join(testDir, "other-clone")
      await git(testDir, ["clone", remoteDir, "other-clone"])
      await git(otherClone, ["config", "user.email", "test@test.com"])
      await git(otherClone, ["config", "user.name", "Test User"])
      await writeFile(join(otherClone, "remote-change.txt"), "remote change")
      await git(otherClone, ["add", "."])
      await git(otherClone, ["commit", "-m", "Add remote change"])
      await git(otherClone, ["push"])

      // Pull latest
      await manager.pullLatest()

      // Verify main workspace has the remote change
      const remoteFileExists = existsSync(join(mainWorkspacePath, "remote-change.txt"))
      expect(remoteFileExists).toBe(true)
    })

    it("succeeds when no remote is configured", async () => {
      // Should not throw
      await manager.pullLatest()
    })
  })
})
