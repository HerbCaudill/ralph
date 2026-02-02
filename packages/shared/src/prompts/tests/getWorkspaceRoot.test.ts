import { describe, it, expect, afterEach } from "vitest"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { getWorkspaceRoot } from ".././getWorkspaceRoot.js"

describe("getWorkspaceRoot", () => {
  const testDir = join(tmpdir(), `getWorkspaceRoot-test-${Date.now()}`)

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it("returns the nearest ancestor with a .git directory", () => {
    const repoRoot = join(testDir, "repo")
    const nested = join(repoRoot, "packages", "app")
    mkdirSync(join(repoRoot, ".git"), { recursive: true })
    mkdirSync(nested, { recursive: true })

    const root = getWorkspaceRoot(nested)
    expect(root).toBe(repoRoot)
  })

  it("returns the nearest ancestor with a .git file", () => {
    const repoRoot = join(testDir, "worktree")
    const nested = join(repoRoot, "packages", "app")
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(repoRoot, ".git"), "gitdir: /tmp/somewhere")

    const root = getWorkspaceRoot(nested)
    expect(root).toBe(repoRoot)
  })

  it("returns the starting directory when no .git is found", () => {
    const nested = join(testDir, "no-repo", "packages", "app")
    mkdirSync(nested, { recursive: true })

    const root = getWorkspaceRoot(nested)
    expect(root).toBe(nested)
  })
})
