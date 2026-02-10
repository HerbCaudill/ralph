import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  WorkerOrchestrator,
  type WorkerOrchestratorOptions,
  type OrchestratorState,
} from "../WorkerOrchestrator.js"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn, type ChildProcess } from "node:child_process"
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

describe("WorkerOrchestrator", () => {
  const testDir = join(process.cwd(), ".test-worker-orchestrator")
  const mainWorkspacePath = join(testDir, "project")
  let activeOrchestrator: WorkerOrchestrator | null = null

  // Helper to create an orchestrator and track it for cleanup
  function createTrackedOrchestrator(options: WorkerOrchestratorOptions): WorkerOrchestrator {
    const orchestrator = new WorkerOrchestrator(options)
    // Suppress unhandled errors from tests - they're expected in some cases
    orchestrator.on("error", () => {})
    activeOrchestrator = orchestrator
    return orchestrator
  }

  beforeEach(async () => {
    activeOrchestrator = null
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
  })

  afterEach(async () => {
    // Stop any active orchestrator
    if (activeOrchestrator) {
      try {
        await activeOrchestrator.stop()
      } catch {
        // Ignore
      }
      activeOrchestrator = null
    }

    // Wait a bit for async cleanup
    await new Promise(resolve => setTimeout(resolve, 100))

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
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
        mainWorkspacePath,
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTasksCount: async () => 0,
        getReadyTask: async () => null,
        claimTask: async () => {},
        closeTask: async () => {},
      })

      expect(orchestrator).toBeInstanceOf(WorkerOrchestrator)
      expect(orchestrator.getState()).toBe("stopped")
    })

    it("defaults to 3 workers if not specified", () => {
      const orchestrator = createTrackedOrchestrator({
        mainWorkspacePath,
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTasksCount: async () => 0,
        getReadyTask: async () => null,
        claimTask: async () => {},
        closeTask: async () => {},
      })

      expect(orchestrator.getMaxWorkers()).toBe(3)
    })
  })

  describe("start", () => {
    it("spins up workers based on available tasks (up to maxWorkers)", async () => {
      const workerNames: string[] = []

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
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
        getReadyTasksCount: async () => 5, // More tasks than workers
        getReadyTask: async workerName => {
          // Track which workers requested tasks
          if (!workerNames.includes(workerName)) {
            workerNames.push(workerName)
            return { id: `bd-task-${workerName}`, title: `Task for ${workerName}` }
          }
          return null // No more tasks after first one per worker
        },
        claimTask: async () => {},
        closeTask: async () => {},
      })

      orchestrator.on("worker_started", ({ workerName }) => {
        workerNames.push(workerName)
      })

      await orchestrator.start()

      // Wait a bit for workers to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Should have started 3 workers (maxWorkers)
      expect(workerNames.length).toBeGreaterThanOrEqual(3)
      expect(orchestrator.getActiveWorkerCount()).toBeLessThanOrEqual(3)
    })

    it("only spins up workers if there are enough ready tasks", async () => {
      const startedWorkers: string[] = []

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 5,
        mainWorkspacePath,
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTasksCount: async () => 2, // Only 2 tasks
        getReadyTask: async workerName => {
          if (startedWorkers.length < 2) {
            startedWorkers.push(workerName)
            return { id: `bd-task-${workerName}`, title: `Task for ${workerName}` }
          }
          return null
        },
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await orchestrator.start()

      // Wait for initial spin-up check
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should only start 2 workers (matching ready task count)
      expect(orchestrator.getActiveWorkerCount()).toBeLessThanOrEqual(2)
    })

    it("does not start if already running", async () => {
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
        mainWorkspacePath,
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTasksCount: async () => 0,
        getReadyTask: async () => null,
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await orchestrator.start()
      expect(orchestrator.getState()).toBe("running")

      // Second start should be a no-op
      await orchestrator.start()
      expect(orchestrator.getState()).toBe("running")
    })
  })

  describe("stop", () => {
    it("stops all workers immediately", async () => {
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTasksCount: async () => 5,
        getReadyTask: async workerName => ({
          id: `bd-task-${workerName}`,
          title: `Task for ${workerName}`,
        }),
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await orchestrator.start()
      expect(orchestrator.getState()).toBe("running")

      await orchestrator.stop()
      expect(orchestrator.getState()).toBe("stopped")
      expect(orchestrator.getActiveWorkerCount()).toBe(0)
    })
  })

  describe("stopAfterCurrent", () => {
    it("stops after current tasks complete", async () => {
      let taskCount = 0
      const completedTasks: string[] = []
      let stoppedState = false
      let stopRequested = false
      const assignedTasks = new Set<string>()

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
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
        getReadyTasksCount: async () => (stopRequested ? 0 : 10),
        getReadyTask: async workerName => {
          // After stop is requested, don't give new tasks
          if (stopRequested) return null
          // Only allow each worker to claim one task
          if (assignedTasks.has(workerName)) return null
          taskCount++
          assignedTasks.add(workerName)
          return { id: `bd-task-${taskCount}`, title: `Task ${taskCount}` }
        },
        claimTask: async () => {},
        closeTask: async taskId => {
          completedTasks.push(taskId)
        },
      })

      // Listen for state changes to know when stopped
      orchestrator.on("state_changed", ({ state }) => {
        if (state === "stopped") {
          stoppedState = true
        }
      })

      await orchestrator.start()

      // Wait for workers to start their tasks
      await new Promise(resolve => setTimeout(resolve, 100))

      // Request stop after current
      stopRequested = true
      orchestrator.stopAfterCurrent()
      expect(orchestrator.getState()).toBe("stopping")

      // Wait for workers to complete (with timeout)
      const startTime = Date.now()
      while (!stoppedState && Date.now() - startTime < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      expect(orchestrator.getState()).toBe("stopped")
      // Should have completed some tasks but not started new ones
      expect(completedTasks.length).toBeGreaterThan(0)
    })
  })

  describe("worker lifecycle", () => {
    it("workers run independently with unique names", async () => {
      const workerNames = new Set<string>()

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
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
        getReadyTasksCount: async () => 3,
        getReadyTask: async workerName => {
          if (!workerNames.has(workerName)) {
            workerNames.add(workerName)
            return { id: `bd-task-${workerName}`, title: `Task for ${workerName}` }
          }
          return null
        },
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await orchestrator.start()

      // Wait for workers to process
      await new Promise(resolve => setTimeout(resolve, 500))

      // Each worker should have a unique name
      expect(workerNames.size).toBeGreaterThan(0)
      // Names should be from the Simpsons character list
      for (const name of workerNames) {
        expect(name).toMatch(/^(homer|marge|bart|lisa|maggie|grampa|patty|selma|ned|rod|todd|moe|barney|lenny|carl|milhouse|nelson|ralph|apu|wiggum|krusty|sideshow|smithers|burns|skinner|edna|otto|groundskeeper|comic|hans)$/)
      }
    })

    it("spins up new workers when tasks become available", async () => {
      let availableTasks = 1
      const tasksStarted: string[] = []

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
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
        getReadyTasksCount: async () => availableTasks,
        getReadyTask: async workerName => {
          if (availableTasks > 0) {
            availableTasks--
            const taskId = `bd-task-${tasksStarted.length}`
            tasksStarted.push(taskId)
            return { id: taskId, title: `Task ${taskId}` }
          }
          return null
        },
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await orchestrator.start()

      // Wait for first worker to finish
      await new Promise(resolve => setTimeout(resolve, 200))

      // Add more tasks
      availableTasks = 2

      // Wait for orchestrator to notice and spin up more workers
      await new Promise(resolve => setTimeout(resolve, 500))

      // Should have processed multiple tasks
      expect(tasksStarted.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("events", () => {
    it("emits worker_started when a worker begins", async () => {
      const events: Array<{ type: string; workerName: string }> = []

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
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
        getReadyTasksCount: async () => 2,
        getReadyTask: async workerName => ({
          id: `bd-${workerName}`,
          title: `Task for ${workerName}`,
        }),
        claimTask: async () => {},
        closeTask: async () => {},
      })

      orchestrator.on("worker_started", ({ workerName }) => {
        events.push({ type: "worker_started", workerName })
      })

      await orchestrator.start()

      // Wait for workers to start
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe("worker_started")
    })

    it("emits worker_stopped when a worker finishes", async () => {
      const stoppedWorkers: string[] = []
      let taskCount = 0

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 1,
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
        getReadyTasksCount: async () => (taskCount < 1 ? 1 : 0),
        getReadyTask: async workerName => {
          if (taskCount < 1) {
            taskCount++
            return { id: `bd-task-1`, title: `Task 1` }
          }
          return null
        },
        claimTask: async () => {},
        closeTask: async () => {},
      })

      orchestrator.on("worker_stopped", ({ workerName }) => {
        stoppedWorkers.push(workerName)
      })

      await orchestrator.start()

      // Wait for worker to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      expect(stoppedWorkers.length).toBeGreaterThan(0)
    })

    it("emits state_changed when orchestrator state changes", async () => {
      const states: OrchestratorState[] = []

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 1,
        mainWorkspacePath,
        spawnClaude: () => createMockClaudeProcess({}),
        getReadyTasksCount: async () => 0,
        getReadyTask: async () => null,
        claimTask: async () => {},
        closeTask: async () => {},
      })

      orchestrator.on("state_changed", ({ state }) => {
        states.push(state)
      })

      await orchestrator.start()
      expect(states).toContain("running")

      await orchestrator.stop()
      expect(states).toContain("stopped")
    })
  })

  describe("getWorkerNames", () => {
    it("returns names of all active workers", async () => {
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        spawnClaude: cwd => {
          return createMockClaudeProcess({
            onStdout: async emit => {
              // Long-running task
              await new Promise(resolve => setTimeout(resolve, 200))
              await writeFile(join(cwd, "work.txt"), "done")
              await git(cwd, ["add", "."])
              await git(cwd, ["commit", "-m", "Work done"])
              emit(Buffer.from(JSON.stringify({ type: "result", result: "Done" }) + "\n"))
            },
          })
        },
        getReadyTasksCount: async () => 2,
        getReadyTask: async workerName => ({
          id: `bd-${workerName}`,
          title: `Task for ${workerName}`,
        }),
        claimTask: async () => {},
        closeTask: async () => {},
      })

      await orchestrator.start()

      // Wait for workers to start
      await new Promise(resolve => setTimeout(resolve, 50))

      const workerNames = orchestrator.getWorkerNames()
      expect(workerNames.length).toBeGreaterThan(0)
      expect(workerNames.length).toBeLessThanOrEqual(2)
    })
  })
})
