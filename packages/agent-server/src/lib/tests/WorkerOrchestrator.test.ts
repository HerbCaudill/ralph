import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  WorkerOrchestrator,
  type WorkerOrchestratorOptions,
  type OrchestratorState,
} from "../WorkerOrchestrator.js"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "node:child_process"

/**
 * Simulates work in a worktree (writing a file, staging, and committing).
 * Checks the abort signal before each operation to avoid ENOENT errors
 * when tests clean up directories mid-operation.
 */
async function simulateWork(
  /** Working directory path */
  cwd: string,
  /** Abort signal to check for cancellation */
  signal: AbortSignal,
  /** Optional delay before starting work (to simulate long-running tasks) */
  delayMs?: number,
): Promise<void> {
  if (delayMs) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
    if (signal.aborted) return
  }
  if (signal.aborted) return
  await writeFile(join(cwd, "work.txt"), "done")
  if (signal.aborted) return
  await git(cwd, ["add", "."])
  if (signal.aborted) return
  await git(cwd, ["commit", "-m", "Work done"])
}

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
 * Create a mock runAgent function that simulates an agent session.
 * Returns the configured exit code and a generated session ID.
 */
function createMockRunAgent(options: {
  exitCode?: number
  onRun?: (cwd: string, signal: AbortSignal) => void | Promise<void>
  delayMs?: number
}): {
  runAgent: (cwd: string) => Promise<{ exitCode: number; sessionId: string }>
  abort: () => void
} {
  const abortController = new AbortController()

  const runAgent = async (cwd: string) => {
    if (options.onRun) {
      await options.onRun(cwd, abortController.signal)
    } else if (options.delayMs) {
      await new Promise(resolve => setTimeout(resolve, options.delayMs))
    }
    return { exitCode: options.exitCode ?? 0, sessionId: `session-${Date.now()}` }
  }

  return { runAgent, abort: () => abortController.abort() }
}

describe("WorkerOrchestrator", () => {
  const testDir = join(process.cwd(), ".test-worker-orchestrator")
  const mainWorkspacePath = join(testDir, "project")
  let activeOrchestrator: WorkerOrchestrator | null = null

  /** Create an orchestrator and track it for cleanup. */
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
      const { runAgent } = createMockRunAgent({})
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 0,
      })

      expect(orchestrator).toBeInstanceOf(WorkerOrchestrator)
      expect(orchestrator.getState()).toBe("stopped")
    })

    it("defaults to 3 workers if not specified", () => {
      const { runAgent } = createMockRunAgent({})
      const orchestrator = createTrackedOrchestrator({
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 0,
      })

      expect(orchestrator.getMaxWorkers()).toBe(3)
    })
  })

  describe("start", () => {
    it("spins up workers based on available tasks (up to maxWorkers)", async () => {
      const workerNames: string[] = []

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 5, // More tasks than workers
      })

      orchestrator.on("worker_started", ({ workerName }) => {
        workerNames.push(workerName)
      })

      await orchestrator.start()

      // Wait a bit for workers to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Should have started workers (up to maxWorkers)
      expect(workerNames.length).toBeGreaterThanOrEqual(1)
      expect(orchestrator.getActiveWorkerCount()).toBeLessThanOrEqual(3)
    })

    it("only spins up workers if there are enough ready tasks", async () => {
      const { runAgent } = createMockRunAgent({})
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 5,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 2, // Only 2 tasks
      })

      await orchestrator.start()

      // Wait for initial spin-up check
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should only start up to 2 workers (matching ready task count)
      expect(orchestrator.getActiveWorkerCount()).toBeLessThanOrEqual(2)
    })

    it("does not start if already running", async () => {
      const { runAgent } = createMockRunAgent({})
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 0,
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
      const { runAgent } = createMockRunAgent({})
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 5,
      })

      await orchestrator.start()
      expect(orchestrator.getState()).toBe("running")

      await orchestrator.stop()
      expect(orchestrator.getState()).toBe("stopped")
      expect(orchestrator.getActiveWorkerCount()).toBe(0)
    })
  })

  describe("stopAfterCurrent", () => {
    it("stops after current work iterations complete", async () => {
      let stoppedState = false
      let stopRequested = false

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => (stopRequested ? 0 : 10),
      })

      // Listen for state changes to know when stopped
      orchestrator.on("state_changed", ({ state }) => {
        if (state === "stopped") {
          stoppedState = true
        }
      })

      await orchestrator.start()

      // Wait for workers to start
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
    })
  })

  describe("worker lifecycle", () => {
    it("workers run independently with unique names", async () => {
      const workerNames = new Set<string>()

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 3,
      })

      orchestrator.on("worker_started", ({ workerName }) => {
        workerNames.add(workerName)
      })

      await orchestrator.start()

      // Wait for workers to process
      await new Promise(resolve => setTimeout(resolve, 500))

      // Each worker should have a unique name
      expect(workerNames.size).toBeGreaterThan(0)
      // Names should be from the Simpsons character list
      for (const name of workerNames) {
        expect(name).toMatch(
          /^(homer|marge|bart|lisa|maggie|grampa|patty|selma|ned|rod|todd|moe|barney|lenny|carl|milhouse|nelson|ralph|apu|wiggum|krusty|sideshow|smithers|burns|skinner|edna|otto|groundskeeper|comic|hans)$/,
        )
      }
    })

    it("spins up new workers when tasks become available", async () => {
      let availableTasks = 1
      const workStarted: string[] = []

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 3,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => availableTasks,
      })

      orchestrator.on("work_started", ({ workId }) => {
        workStarted.push(workId)
      })

      await orchestrator.start()

      // Wait for first worker to finish
      await new Promise(resolve => setTimeout(resolve, 200))

      // Add more tasks
      availableTasks = 2

      // Wait for orchestrator to notice and spin up more workers
      await new Promise(resolve => setTimeout(resolve, 500))

      // Should have processed work iterations
      expect(workStarted.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("events", () => {
    it("emits worker_started when a worker begins", async () => {
      const events: Array<{ type: string; workerName: string }> = []

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 2,
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

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal)
        },
      })

      let taskCount = 0
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 1,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => (taskCount < 1 ? 1 : 0),
      })

      // Increment on work_started to ensure only one iteration
      orchestrator.on("work_started", () => {
        taskCount++
      })

      orchestrator.on("worker_stopped", ({ workerName }) => {
        stoppedWorkers.push(workerName)
      })

      await orchestrator.start()

      // Wait for worker to complete (with timeout)
      const startTime = Date.now()
      while (stoppedWorkers.length === 0 && Date.now() - startTime < 3000) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      expect(stoppedWorkers.length).toBeGreaterThan(0)
    })

    it("emits state_changed when orchestrator state changes", async () => {
      const states: OrchestratorState[] = []

      const { runAgent } = createMockRunAgent({})
      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 1,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 0,
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
      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal, 200)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 2,
      })

      await orchestrator.start()

      // Wait for workers to start
      await new Promise(resolve => setTimeout(resolve, 50))

      const workerNames = orchestrator.getWorkerNames()
      expect(workerNames.length).toBeGreaterThan(0)
      expect(workerNames.length).toBeLessThanOrEqual(2)
    })
  })

  describe("per-worker controls", () => {
    it("can pause a specific worker", async () => {
      const pausedWorkers: string[] = []

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal, 300)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 2,
      })

      orchestrator.on("worker_paused", ({ workerName }) => {
        pausedWorkers.push(workerName)
      })

      await orchestrator.start()

      // Wait for workers to start
      await new Promise(resolve => setTimeout(resolve, 100))

      const workerNames = orchestrator.getWorkerNames()
      expect(workerNames.length).toBeGreaterThan(0)

      // Pause one worker
      const workerToPause = workerNames[0]
      orchestrator.pauseWorker(workerToPause)

      // Wait for pause to take effect
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(pausedWorkers).toContain(workerToPause)
      expect(orchestrator.getWorkerState(workerToPause)).toBe("paused")
    })

    it("can resume a paused worker", async () => {
      const events: Array<{ type: string; workerName: string }> = []

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal, 200)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 1,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 2,
      })

      orchestrator.on("worker_paused", ({ workerName }) => {
        events.push({ type: "paused", workerName })
      })
      orchestrator.on("worker_resumed", ({ workerName }) => {
        events.push({ type: "resumed", workerName })
      })

      await orchestrator.start()

      // Wait for worker to start
      await new Promise(resolve => setTimeout(resolve, 100))

      const workerNames = orchestrator.getWorkerNames()
      const workerName = workerNames[0]

      // Pause worker
      orchestrator.pauseWorker(workerName)
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(orchestrator.getWorkerState(workerName)).toBe("paused")

      // Resume worker
      orchestrator.resumeWorker(workerName)
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(orchestrator.getWorkerState(workerName)).toBe("running")

      expect(events.some(e => e.type === "paused" && e.workerName === workerName)).toBe(true)
      expect(events.some(e => e.type === "resumed" && e.workerName === workerName)).toBe(true)
    })

    it("can stop a specific worker without affecting others", async () => {
      const stoppedWorkers: string[] = []
      const startedWorkers: string[] = []

      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal, 300)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 5,
      })

      orchestrator.on("worker_started", ({ workerName }) => {
        startedWorkers.push(workerName)
      })
      orchestrator.on("worker_stopped", ({ workerName }) => {
        stoppedWorkers.push(workerName)
      })

      await orchestrator.start()

      // Wait for workers to start
      await new Promise(resolve => setTimeout(resolve, 100))

      const workerNames = orchestrator.getWorkerNames()
      expect(workerNames.length).toBe(2)

      // Stop one worker
      const workerToStop = workerNames[0]
      orchestrator.stopWorker(workerToStop)

      // Wait for stop to take effect
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(stoppedWorkers).toContain(workerToStop)

      // Other worker should still be running
      const remainingWorkers = orchestrator.getWorkerNames()
      expect(remainingWorkers).not.toContain(workerToStop)
      expect(remainingWorkers.length).toBeGreaterThan(0)
    })

    it("getWorkerState returns correct state for each worker", async () => {
      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal, 300)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 2,
      })

      await orchestrator.start()

      // Wait for workers to start
      await new Promise(resolve => setTimeout(resolve, 100))

      const workerNames = orchestrator.getWorkerNames()
      expect(workerNames.length).toBe(2)

      // All workers should be running
      for (const name of workerNames) {
        expect(orchestrator.getWorkerState(name)).toBe("running")
      }

      // Pause one
      orchestrator.pauseWorker(workerNames[0])
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(orchestrator.getWorkerState(workerNames[0])).toBe("paused")
      expect(orchestrator.getWorkerState(workerNames[1])).toBe("running")

      // Non-existent worker should return null
      expect(orchestrator.getWorkerState("nonexistent")).toBe(null)
    })

    it("getWorkerStates returns all worker states", async () => {
      const { runAgent } = createMockRunAgent({
        onRun: async (cwd, signal) => {
          await simulateWork(cwd, signal, 300)
        },
      })

      const orchestrator = createTrackedOrchestrator({
        maxWorkers: 2,
        mainWorkspacePath,
        runAgent,
        getReadyTasksCount: async () => 2,
      })

      await orchestrator.start()

      // Wait for workers to start
      await new Promise(resolve => setTimeout(resolve, 100))

      const states = orchestrator.getWorkerStates()
      expect(Object.keys(states).length).toBe(2)

      for (const [name, state] of Object.entries(states)) {
        expect(state.state).toBe("running")
        expect(state.workerName).toBe(name)
        expect(state.currentWorkId).toBeDefined()
      }
    })
  })
})
