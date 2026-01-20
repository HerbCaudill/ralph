import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { execSync } from "node:child_process"
import { getGitBranch } from "./index.js"

describe("getGitBranch", () => {
  const testDir = path.join(import.meta.dirname, "__test_git_branch__")

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
  })

  it("returns the current branch name in a git repo", async () => {
    // Initialize a git repo with a branch
    execSync("git init", { cwd: testDir })
    execSync("git config user.email 'test@test.com'", { cwd: testDir })
    execSync("git config user.name 'Test'", { cwd: testDir })
    execSync("touch test.txt && git add . && git commit --no-verify -m 'initial'", {
      cwd: testDir,
      shell: "/bin/bash",
    })
    execSync("git checkout -b feature/test-branch", { cwd: testDir })

    const branch = await getGitBranch(testDir)
    expect(branch).toBe("feature/test-branch")
  })

  it("returns 'main' for a new repo on main branch", async () => {
    // Initialize a git repo
    execSync("git init --initial-branch=main", { cwd: testDir })
    execSync("git config user.email 'test@test.com'", { cwd: testDir })
    execSync("git config user.name 'Test'", { cwd: testDir })
    execSync("touch test.txt && git add . && git commit --no-verify -m 'initial'", {
      cwd: testDir,
      shell: "/bin/bash",
    })

    const branch = await getGitBranch(testDir)
    expect(branch).toBe("main")
  })

  it("returns null when directory is not a git repo", async () => {
    // Use /tmp which is not a git repo
    const branch = await getGitBranch("/tmp")
    expect(branch).toBeNull()
  })

  it("returns null when directory does not exist", async () => {
    const branch = await getGitBranch("/nonexistent/path")
    expect(branch).toBeNull()
  })
})
