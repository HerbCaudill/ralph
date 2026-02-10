import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { WorkerLoop, type WorkerLoopOptions, type WorkerLoopEvents } from "../WorkerLoop.js"
import { WorktreeManager } from "../WorktreeManager.js"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { EventEmitter } from "node:events"

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
 * Mock function for spawning Claude CLI process.
 * Returns a mock ChildProcess that immediately completes successfully.
 */
function createMockClaudeProcess(options: {
  exitCode?: number
  stdout?: string[]
  onStdout?: (callback: (chunk: Buffer) => void) => void
}): ChildProcess {
  const proc = new EventEmitter() as unknown as ChildProcess
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()

  // @ts-expect-error - mocking ChildProcess
  proc.stdout = stdout
  // @ts-expect-error - mocking ChildProcess
  proc.stderr = stderr
  // @ts-expect-error - mocking ChildProcess
  proc.pid = 12345
  // @ts-expect-error - mocking ChildProcess
  proc.killed = false
  // @ts-expect-error - mocking ChildProcess
  proc.kill = () => {
    // @ts-expect-error - mocking ChildProcess
    proc.killed = true
    proc.emit("close", 0)
    return true
  }

  // Schedule stdout chunks and exit
  setTimeout(() => {
    if (options.onStdout) {
      options.onStdout(chunk => stdout.emit("data", chunk))
    } else if (options.stdout) {
      for (const line of options.stdout) {
        stdout.emit("data", Buffer.from(line + "\n"))
      }
    }
    proc.emit("close", options.exitCode ?? 0)
  }, 10)

  return proc
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
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTask: async () => null,
        claimTask: async () => {},
        closeTask: async () => {},
      })

      expect(loop).toBeInstanceOf(WorkerLoop)
    })
  })

  describe("getReadyTask integration", () => {
    it("exits when no tasks are available", async () => {
      const events: string[] = []
      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTask: async () => null,
        claimTask: async () => {},
        closeTask: async () => {},
      })

      loop.on("idle", () => events.push("idle"))

      await loop.runOnce()

      expect(events).toContain("idle")
    })

    it("claims and processes a task when one is available", async () => {
      const events: string[] = []
      const claimedTasks: string[] = []
      const closedTasks: string[] = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: () =>
          createMockClaudeProcess({
            stdout: [
              JSON.stringify({ type: "assistant", message: { content: "Working..." } }),
              JSON.stringify({ type: "result", result: "Done" }),
            ],
          }),
        getReadyTask: async () => ({ id: "bd-abc123", title: "Test task" }),
        claimTask: async taskId => {
          claimedTasks.push(taskId)
        },
        closeTask: async taskId => {
          closedTasks.push(taskId)
        },
      })

      loop.on("task_started", ({ taskId }) => events.push(`started:${taskId}`))
      loop.on("task_completed", ({ taskId }) => events.push(`completed:${taskId}`))

      await loop.runOnce()

      expect(claimedTasks).toContain("bd-abc123")
      expect(events).toContain("started:bd-abc123")
    })
  })

  describe("worktree lifecycle", () => {
    it("creates worktree for task and cleans up after completion", async () => {
      let worktreePath: string | undefined

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: cwd => {
          worktreePath = cwd
          // Make a change in the worktree
          return createMockClaudeProcess({
            onStdout: async emit => {
              // Simulate Claude making a change
              await writeFile(join(cwd, "new-file.txt"), "created by claude")
              await git(cwd, ["add", "."])
              await git(cwd, ["commit", "-m", "Add new file"])
              emit(Buffer.from(JSON.stringify({ type: "result", result: "Done" }) + "\n"))
            },
          })
        },
        getReadyTask: async () => ({ id: "bd-abc123", title: "Test task" }),
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await loop.runOnce()

      // Worktree should have been created in correct location
      expect(worktreePath).toBe(worktreeManager.getWorktreePath("homer", "bd-abc123"))

      // After completion, worktree should be cleaned up (merged and removed)
      const exists = await worktreeManager.exists("homer", "bd-abc123")
      expect(exists).toBe(false)

      // The changes should be merged into main
      const mainContent = existsSync(join(mainWorkspacePath, "new-file.txt"))
      expect(mainContent).toBe(true)
    })

    // Note: Complex merge conflict scenarios are tested in WorktreeManager.test.ts.
    // WorkerLoop delegates to WorktreeManager for all git operations.
  })

  describe("Claude process handling", () => {
    it("passes correct working directory to spawnClaude", async () => {
      let receivedCwd: string | undefined

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: cwd => {
          receivedCwd = cwd
          return createMockClaudeProcess({
            stdout: [JSON.stringify({ type: "result", result: "Done" })],
          })
        },
        getReadyTask: async () => ({ id: "bd-task-xyz", title: "Test" }),
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await loop.runOnce()

      expect(receivedCwd).toBe(worktreeManager.getWorktreePath("homer", "bd-task-xyz"))
    })

    it("handles Claude process error gracefully", async () => {
      const errors: Error[] = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: () =>
          createMockClaudeProcess({
            exitCode: 1,
            stdout: [JSON.stringify({ type: "error", message: "Something went wrong" })],
          }),
        getReadyTask: async () => ({ id: "bd-abc123", title: "Test" }),
        claimTask: async () => {},
        closeTask: async () => {},
      })

      loop.on("error", err => errors.push(err))

      await loop.runOnce()

      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe("event emission", () => {
    it("emits lifecycle events in correct order", async () => {
      const events: string[] = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: cwd => {
          return createMockClaudeProcess({
            onStdout: async emit => {
              await writeFile(join(cwd, "work.txt"), "done")
              await git(cwd, ["add", "."])
              await git(cwd, ["commit", "-m", "Work done"])
              emit(Buffer.from(JSON.stringify({ type: "result", result: "Done" }) + "\n"))
            },
          })
        },
        getReadyTask: async () => ({ id: "bd-abc123", title: "Test" }),
        claimTask: async () => {},
        closeTask: async () => {},
      })

      loop.on("task_started", () => events.push("task_started"))
      loop.on("worktree_created", () => events.push("worktree_created"))
      loop.on("claude_started", () => events.push("claude_started"))
      loop.on("claude_completed", () => events.push("claude_completed"))
      loop.on("merge_completed", () => events.push("merge_completed"))
      loop.on("task_completed", () => events.push("task_completed"))

      await loop.runOnce()

      expect(events).toEqual([
        "task_started",
        "worktree_created",
        "claude_started",
        "claude_completed",
        "merge_completed",
        "task_completed",
      ])
    })
  })

  describe("tests passing (verifying test is run)", () => {
    it("runs tests before completing task", async () => {
      let testsPassed = false

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: cwd => {
          return createMockClaudeProcess({
            onStdout: async emit => {
              await writeFile(join(cwd, "work.txt"), "done")
              await git(cwd, ["add", "."])
              await git(cwd, ["commit", "-m", "Work done"])
              emit(Buffer.from(JSON.stringify({ type: "result", result: "Done" }) + "\n"))
            },
          })
        },
        getReadyTask: async () => ({ id: "bd-abc123", title: "Test" }),
        claimTask: async () => {},
        closeTask: async () => {},
        runTests: async () => {
          testsPassed = true
          return { success: true }
        },
      })

      await loop.runOnce()

      expect(testsPassed).toBe(true)
    })

    it("reports test failure through events", async () => {
      const events: Array<{ success: boolean; output?: string }> = []
      let testAttempts = 0

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: cwd => {
          return createMockClaudeProcess({
            onStdout: async emit => {
              await writeFile(join(cwd, `work-${testAttempts}.txt`), "done")
              await git(cwd, ["add", "."])
              await git(cwd, ["commit", "-m", "Work done"])
              emit(Buffer.from(JSON.stringify({ type: "result", result: "Done" }) + "\n"))
            },
          })
        },
        getReadyTask: async () => ({ id: "bd-abc123", title: "Test" }),
        claimTask: async () => {},
        closeTask: async () => {},
        runTests: async () => {
          testAttempts++
          if (testAttempts === 1) {
            return { success: false, output: "Tests failed" }
          }
          // Pass on second attempt to exit the loop
          return { success: true }
        },
      })

      loop.on("tests_failed", data => events.push(data))

      await loop.runOnce()

      expect(events).toContainEqual({ success: false, output: "Tests failed" })
    })
  })

  describe("continuous loop mode", () => {
    it("continues processing tasks until none available", async () => {
      let taskCount = 0
      const maxTasks = 3
      const processedTasks: string[] = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: cwd => {
          return createMockClaudeProcess({
            onStdout: async emit => {
              await writeFile(join(cwd, `work-${taskCount}.txt`), "done")
              await git(cwd, ["add", "."])
              await git(cwd, ["commit", "-m", `Work ${taskCount} done`])
              emit(Buffer.from(JSON.stringify({ type: "result", result: "Done" }) + "\n"))
            },
          })
        },
        getReadyTask: async () => {
          if (taskCount >= maxTasks) return null
          taskCount++
          return { id: `bd-task-${taskCount}`, title: `Task ${taskCount}` }
        },
        claimTask: async () => {},
        closeTask: async taskId => {
          processedTasks.push(taskId)
        },
      })

      await loop.runLoop()

      expect(processedTasks).toEqual(["bd-task-1", "bd-task-2", "bd-task-3"])
    })

    it("can be stopped gracefully", async () => {
      let taskCount = 0
      const processedTasks: string[] = []

      const loop = new WorkerLoop({
        workerName: "homer",
        mainWorkspacePath,
        spawnClaude: cwd => {
          return createMockClaudeProcess({
            onStdout: async emit => {
              await writeFile(join(cwd, `work-${taskCount}.txt`), "done")
              await git(cwd, ["add", "."])
              await git(cwd, ["commit", "-m", `Work done`])
              emit(Buffer.from(JSON.stringify({ type: "result", result: "Done" }) + "\n"))
            },
          })
        },
        getReadyTask: async () => {
          taskCount++
          if (taskCount >= 2) {
            loop.stop()
          }
          return { id: `bd-task-${taskCount}`, title: `Task ${taskCount}` }
        },
        claimTask: async () => {},
        closeTask: async taskId => {
          processedTasks.push(taskId)
        },
      })

      await loop.runLoop()

      // Should have processed task 1, started task 2, then stopped
      expect(processedTasks.length).toBeLessThanOrEqual(2)
    })
  })

  // Note: Complex retry and conflict resolution scenarios are difficult to test
  // in a unit test context due to git lock contention. The WorktreeManager tests
  // verify the underlying git operations. WorkerLoop's retry logic is verified
  // via the other tests that show the loop continues on error.
})
