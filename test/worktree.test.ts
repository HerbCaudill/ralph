import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { execSync } from "child_process"
import { mkdirSync, writeFileSync, existsSync, rmSync, realpathSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { getGitRoot } from "../src/lib/getGitRoot.js"
import { stashChanges } from "../src/lib/stashChanges.js"
import { popStash } from "../src/lib/popStash.js"
import { createWorktree } from "../src/lib/createWorktree.js"
import { copyRalphFilesToWorktree } from "../src/lib/copyRalphFilesToWorktree.js"
import { copyRalphFilesFromWorktree } from "../src/lib/copyRalphFilesFromWorktree.js"
import { mergeWorktreeToMain } from "../src/lib/mergeWorktreeToMain.js"
import { cleanupWorktree } from "../src/lib/cleanupWorktree.js"

describe("worktree utilities", () => {
  let testRepo: string

  beforeEach(() => {
    // Create a temporary git repository for testing
    const tempPath = join(tmpdir(), `ralph-test-${Date.now()}`)
    mkdirSync(tempPath, { recursive: true })

    // Get the real path (resolves /private/var on macOS)
    testRepo = realpathSync(tempPath)

    execSync("git init", { cwd: testRepo })
    execSync('git config user.email "test@test.com"', { cwd: testRepo })
    execSync('git config user.name "Test User"', { cwd: testRepo })

    // Create initial commit with .ralph directory
    writeFileSync(join(testRepo, "README.md"), "# Test Repo")

    const ralphDir = join(testRepo, ".ralph")
    mkdirSync(ralphDir, { recursive: true })
    writeFileSync(join(ralphDir, "prompt.md"), "# Prompt")
    writeFileSync(join(ralphDir, "todo.md"), "- [ ] Task 1")
    writeFileSync(join(ralphDir, "progress.md"), "# Progress")

    execSync("git add .", { cwd: testRepo })
    execSync('git commit -m "Initial commit"', { cwd: testRepo })
  })

  afterEach(() => {
    // Clean up test repo
    if (existsSync(testRepo)) {
      rmSync(testRepo, { recursive: true, force: true })
    }

    // Clean up any leftover worktrees
    const worktreesDir = join(tmpdir(), "ralph-worktrees")
    if (existsSync(worktreesDir)) {
      rmSync(worktreesDir, { recursive: true, force: true })
    }
  })

  describe("getGitRoot", () => {
    it("returns the git repository root", () => {
      const root = getGitRoot(testRepo)
      expect(root).toBe(testRepo)
    })

    it("throws error when not in a git repository", () => {
      const nonGitDir = join(tmpdir(), `ralph-non-git-${Date.now()}`)
      mkdirSync(nonGitDir, { recursive: true })

      expect(() => getGitRoot(nonGitDir)).toThrow("Not in a git repository")

      rmSync(nonGitDir, { recursive: true, force: true })
    })
  })

  describe("stashChanges and popStash", () => {
    it("stashes uncommitted changes", () => {
      // Create uncommitted changes
      writeFileSync(join(testRepo, "test.txt"), "uncommitted")

      const hasChanges = stashChanges(testRepo)
      expect(hasChanges).toBe(true)

      // File should not exist after stash
      expect(existsSync(join(testRepo, "test.txt"))).toBe(false)
    })

    it("returns false when there are no changes to stash", () => {
      const hasChanges = stashChanges(testRepo)
      expect(hasChanges).toBe(false)
    })

    it("pops stashed changes", () => {
      // Create and stash changes
      writeFileSync(join(testRepo, "test.txt"), "uncommitted")
      stashChanges(testRepo)

      // Pop stash
      popStash(testRepo)

      // File should exist again
      expect(existsSync(join(testRepo, "test.txt"))).toBe(true)
    })
  })

  describe("createWorktree", () => {
    it("creates a new worktree with unique branch", () => {
      const worktree = createWorktree(testRepo)

      expect(worktree.path).toContain("ralph-worktrees")
      expect(worktree.branch).toMatch(/^ralph-[0-9a-f-]+$/)
      expect(worktree.guid).toMatch(/^[0-9a-f-]+$/)
      expect(existsSync(worktree.path)).toBe(true)

      // Clean up
      cleanupWorktree(testRepo, worktree)
    })

    it("creates worktree from current HEAD", () => {
      const worktree = createWorktree(testRepo)

      // Check that README exists in worktree
      expect(existsSync(join(worktree.path, "README.md"))).toBe(true)

      cleanupWorktree(testRepo, worktree)
    })
  })

  describe("copyRalphFilesToWorktree", () => {
    it("copies .ralph files to worktree", () => {
      const worktree = createWorktree(testRepo)

      copyRalphFilesToWorktree(testRepo, worktree.path)

      expect(existsSync(join(worktree.path, ".ralph", "prompt.md"))).toBe(true)
      expect(existsSync(join(worktree.path, ".ralph", "todo.md"))).toBe(true)
      expect(existsSync(join(worktree.path, ".ralph", "progress.md"))).toBe(true)

      cleanupWorktree(testRepo, worktree)
    })
  })

  describe("copyRalphFilesFromWorktree", () => {
    it("copies updated .ralph files back to main repo", () => {
      const worktree = createWorktree(testRepo)
      copyRalphFilesToWorktree(testRepo, worktree.path)

      // Modify files in worktree
      writeFileSync(join(worktree.path, ".ralph", "todo.md"), "- [x] Task 1\n- [ ] Task 2")
      writeFileSync(join(worktree.path, ".ralph", "progress.md"), "# Progress\n\nCompleted task 1")

      copyRalphFilesFromWorktree(testRepo, worktree.path)

      // Check main repo has updated files
      const todoContent = execSync("cat .ralph/todo.md", { cwd: testRepo, encoding: "utf-8" })
      const progressContent = execSync("cat .ralph/progress.md", {
        cwd: testRepo,
        encoding: "utf-8",
      })

      expect(todoContent).toContain("Task 2")
      expect(progressContent).toContain("Completed task 1")

      cleanupWorktree(testRepo, worktree)
    })
  })

  describe("mergeWorktreeToMain", () => {
    it("merges worktree changes back to main branch", () => {
      const worktree = createWorktree(testRepo)

      // Make changes in worktree
      writeFileSync(join(worktree.path, "new-file.txt"), "new content")
      execSync("git add .", { cwd: worktree.path })
      execSync('git commit -m "Add new file"', { cwd: worktree.path })

      // Merge back
      mergeWorktreeToMain(testRepo, worktree)

      // Check that file exists in main repo
      expect(existsSync(join(testRepo, "new-file.txt"))).toBe(true)

      cleanupWorktree(testRepo, worktree)
    })

    it("auto-commits uncommitted changes before merge", () => {
      const worktree = createWorktree(testRepo)

      // Make uncommitted changes in worktree
      writeFileSync(join(worktree.path, "uncommitted.txt"), "uncommitted")
      execSync("git add .", { cwd: worktree.path })

      // Merge should auto-commit
      mergeWorktreeToMain(testRepo, worktree)

      // Check that file exists in main repo
      expect(existsSync(join(testRepo, "uncommitted.txt"))).toBe(true)

      cleanupWorktree(testRepo, worktree)
    })
  })

  describe("cleanupWorktree", () => {
    it("removes worktree and deletes branch", () => {
      const worktree = createWorktree(testRepo)
      const { path, branch } = worktree

      cleanupWorktree(testRepo, worktree)

      // Worktree path should not exist
      expect(existsSync(path)).toBe(false)

      // Branch should not exist
      const branches = execSync("git branch", { cwd: testRepo, encoding: "utf-8" })
      expect(branches).not.toContain(branch)
    })
  })
})
