import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { WorkerLoop, type WorkerLoopOptions, type WorkerLoopEvents } from "../WorkerLoop.js"
import { WorktreeManager } from "../WorktreeManager.js"
import { mkdir, rm, writeFile } from "node:fs/promises"
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

/**
 * Create a mock runAgent callback that simulates agent work.
 * The optional `doWork` callback receives the cwd and can make git changes.
 */
function createMockRunAgent(options?: {
  exitCode?: number
  sessionId?: string
  doWork?: (cwd: string) => Promise<void>
}): (cwd: string) => Promise<{ exitCode: number; sessionId: string }> {
  return async cwd => {
    if (options?.doWork) {
      await options.doWork(cwd)
    }
    return {
      exitCode: options?.exitCode ?? 0,
      sessionId: options?.sessionId ?? "test-session-" + Math.random().toString(36).slice(2),
    }
  }
}

describe("WorkerLoop", () => {
  const testDir = join(process.cwd(), ".test-worker-loop")
  const mainWorkspacePath = join(testDir, "project")
  let worktreeManager: WorktreeManager

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

    worktreeManager = new WorktreeManager(mainWorkspacePath)
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
    it("initializes with required options", () => {
      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent(),
      })

      expect(loop).toBeInstanceOf(WorkerLoop)
    })
  })

  describe("work iteration lifecycle", () => {
    it("runs a single work iteration successfully", async () => {
      const events: string[] = []
      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({
          doWork: async cwd => {
            await writeFile(join(cwd, "new-file.txt"), "created by agent")
            await git(cwd, ["add", "."])
            await git(cwd, ["commit", "-m", "Add new file"])
          },
        }),
      })

      loop.on("work_started", () => events.push("work_started"))
      loop.on("worktree_created", () => events.push("worktree_created"))
      loop.on("agent_started", () => events.push("agent_started"))
      loop.on("agent_completed", () => events.push("agent_completed"))
      loop.on("merge_completed", () => events.push("merge_completed"))
      loop.on("work_completed", () => events.push("work_completed"))

      await loop.runOnce()

      expect(events).toEqual([
        "work_started",
        "worktree_created",
        "agent_started",
        "agent_completed",
        "merge_completed",
        "work_completed",
      ])
    })

    it("creates worktree and cleans up after completion", async () => {
      let worktreePath: string | undefined

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({
          doWork: async cwd => {
            worktreePath = cwd
            await writeFile(join(cwd, "new-file.txt"), "created by agent")
            await git(cwd, ["add", "."])
            await git(cwd, ["commit", "-m", "Add new file"])
          },
        }),
      })

      await loop.runOnce()

      // Worktree should have been created
      expect(worktreePath).toBeDefined()

      // The changes should be merged into main
      const mainContent = existsSync(join(mainWorkspacePath, "new-file.txt"))
      expect(mainContent).toBe(true)
    })
  })

  describe("runAgent handling", () => {
    it("passes correct cwd to runAgent", async () => {
      let receivedCwd: string | undefined

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: async cwd => {
          receivedCwd = cwd
          return { exitCode: 0, sessionId: "test-session" }
        },
      })

      await loop.runOnce()

      // cwd should be a worktree path (not the main workspace)
      expect(receivedCwd).toBeDefined()
      expect(receivedCwd).not.toBe(mainWorkspacePath)
    })

    it("handles non-zero exit code gracefully", async () => {
      const errors: Error[] = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({ exitCode: 1 }),
      })

      loop.on("error", err => errors.push(err))

      await loop.runOnce()

      expect(errors.length).toBeGreaterThan(0)
    })

    it("emits agent_started with workId", async () => {
      const events: Array<{ workId: string; sessionId: string }> = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({ sessionId: "session-abc-123" }),
      })

      loop.on("agent_started", data => events.push(data))

      await loop.runOnce()

      expect(events.length).toBe(1)
      expect(events[0].workId).toBeDefined()
    })

    it("emits agent_completed with sessionId and exitCode", async () => {
      const events: Array<{ workId: string; exitCode: number; sessionId: string }> = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({ exitCode: 0, sessionId: "session-abc-123" }),
      })

      loop.on("agent_completed", data => events.push(data))

      await loop.runOnce()

      expect(events.length).toBe(1)
      expect(events[0].exitCode).toBe(0)
      expect(events[0].sessionId).toBe("session-abc-123")
    })
  })

  describe("tests passing (verifying test is run)", () => {
    it("runs tests before completing work iteration", async () => {
      let testsPassed = false

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({
          doWork: async cwd => {
            await writeFile(join(cwd, "work.txt"), "done")
            await git(cwd, ["add", "."])
            await git(cwd, ["commit", "-m", "Work done"])
          },
        }),
        runTests: async () => {
          testsPassed = true
          return { success: true }
        },
      })

      await loop.runOnce()

      expect(testsPassed).toBe(true)
    })

    it("reports test failure through events", async () => {
      const errors: Error[] = []
      let testAttempts = 0

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({
          doWork: async cwd => {
            await writeFile(join(cwd, `work-${testAttempts}.txt`), "done")
            await git(cwd, ["add", "."])
            await git(cwd, ["commit", "-m", "Work done"])
          },
        }),
        runTests: async () => {
          testAttempts++
          if (testAttempts === 1) {
            return { success: false, output: "Tests failed" }
          }
          // Pass on second attempt to exit the loop
          return { success: true }
        },
      })

      loop.on("error", err => errors.push(err))

      await loop.runOnce()

      expect(errors.some(e => e.message.includes("Tests failed"))).toBe(true)
    })
  })

  describe("continuous loop mode", () => {
    it("can be stopped gracefully", async () => {
      let runCount = 0

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent({
          doWork: async cwd => {
            runCount++
            if (runCount >= 2) {
              loop.stop()
            }
            await writeFile(join(cwd, `work-${runCount}.txt`), "done")
            await git(cwd, ["add", "."])
            await git(cwd, ["commit", "-m", `Work done`])
          },
        }),
      })

      await loop.runLoop()

      // Should have run at least once before stopping
      expect(runCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe("pause and resume", () => {
    it("can be paused and isPaused returns true", () => {
      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent(),
      })

      expect(loop.isPaused()).toBe(false)

      loop.pause()

      expect(loop.isPaused()).toBe(true)
      expect(loop.getState()).toBe("paused")
    })

    it("can be resumed after pause", () => {
      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent(),
      })

      loop.pause()
      expect(loop.isPaused()).toBe(true)

      loop.resume()
      expect(loop.isPaused()).toBe(false)
    })

    it("emits paused event when paused", () => {
      const events: Array<{ workId?: string }> = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent(),
      })

      loop.on("paused", data => events.push(data))

      loop.pause()

      expect(events.length).toBe(1)
      expect(events[0].workId).toBeUndefined()
    })

    it("emits resumed event when resumed", () => {
      const events: string[] = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent(),
      })

      loop.on("resumed", () => events.push("resumed"))

      loop.pause()
      loop.resume()

      expect(events).toContain("resumed")
    })

    it("getState returns current worker state", async () => {
      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent(),
      })

      expect(loop.getState()).toBe("idle")

      // Start a simple run
      await loop.runOnce()

      expect(loop.getState()).toBe("idle")
    })

    it("getCurrentWorkId returns null when no work", () => {
      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        runAgent: createMockRunAgent(),
      })

      expect(loop.getCurrentWorkId()).toBe(null)
    })
  })
})
