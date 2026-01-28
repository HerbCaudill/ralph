import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import { RalphManager, type RalphEvent, type SpawnFn } from "./RalphManager"

/**
 * Create a mock process helper for testing RalphManager.
 */
function createMockProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { writable: boolean; write: ReturnType<typeof vi.fn> }
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
  }
  proc.stdin = { writable: true, write: vi.fn() }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

describe("RalphManager", () => {
  let manager: RalphManager
  let mockProcess: ReturnType<typeof createMockProcess>
  let mockSpawn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockProcess = createMockProcess()
    mockSpawn = vi.fn().mockReturnValue(mockProcess)
    manager = new RalphManager({ spawn: mockSpawn as unknown as SpawnFn })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("initialization", () => {
    it("starts with stopped status", () => {
      expect(manager.status).toBe("stopped")
      expect(manager.isRunning).toBe(false)
      expect(manager.canAcceptMessages).toBe(false)
    })

    it("accepts custom options", () => {
      const customManager = new RalphManager({
        command: "custom-ralph",
        args: ["--custom"],
        cwd: "/custom/path",
        env: { CUSTOM_VAR: "value" },
        spawn: mockSpawn as unknown as SpawnFn,
      })
      expect(customManager.status).toBe("stopped")
    })
  })

  describe("start", () => {
    it("spawns ralph process with --json flag", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        }),
      )
    })

    it("uses custom cwd when provided", async () => {
      const customManager = new RalphManager({
        cwd: "/path/to/worktree",
        spawn: mockSpawn as unknown as SpawnFn,
      })

      const startPromise = customManager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json"],
        expect.objectContaining({
          cwd: "/path/to/worktree",
        }),
      )
    })

    it("includes sessions argument when provided", async () => {
      const startPromise = manager.start(50)
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json", "50"],
        expect.anything(),
      )
    })

    it("includes --watch flag when watch option is enabled", async () => {
      const watchManager = new RalphManager({
        spawn: mockSpawn as unknown as SpawnFn,
        watch: true,
      })

      const startPromise = watchManager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json", "--watch"],
        expect.anything(),
      )
    })

    it("includes both --watch and sessions when both provided", async () => {
      const watchManager = new RalphManager({
        spawn: mockSpawn as unknown as SpawnFn,
        watch: true,
      })

      const startPromise = watchManager.start(25)
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json", "--watch", "25"],
        expect.anything(),
      )
    })

    it("includes --agent flag when agent is not 'claude'", async () => {
      const codexManager = new RalphManager({
        spawn: mockSpawn as unknown as SpawnFn,
        agent: "codex",
      })

      const startPromise = codexManager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json", "--agent", "codex"],
        expect.anything(),
      )
    })

    it("does not include --agent flag when agent is 'claude' (default)", async () => {
      const defaultManager = new RalphManager({
        spawn: mockSpawn as unknown as SpawnFn,
        agent: "claude",
      })

      const startPromise = defaultManager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json"],
        expect.anything(),
      )
    })

    it("includes --agent flag with watch and sessions", async () => {
      const codexManager = new RalphManager({
        spawn: mockSpawn as unknown as SpawnFn,
        agent: "codex",
        watch: true,
      })

      const startPromise = codexManager.start(30)
      mockProcess.emit("spawn")
      await startPromise

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["@herbcaudill/ralph", "--json", "--agent", "codex", "--watch", "30"],
        expect.anything(),
      )
    })

    it("transitions to running status", async () => {
      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(statusChanges).toContain("starting")
      expect(statusChanges).toContain("running")
      expect(manager.status).toBe("running")
      expect(manager.isRunning).toBe(true)
    })

    it("throws if already running", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      await expect(manager.start()).rejects.toThrow("Ralph is already running")
    })

    it("does not emit system init event on spawn (boundaries come from CLI)", async () => {
      const events: RalphEvent[] = []
      manager.on("event", evt => events.push(evt))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      // Session boundaries are now exclusively marked by ralph_session_start
      // events from the CLI, which include richer metadata (sessionId, taskId, repo).
      expect(events).toHaveLength(0)
    })

    it("emits error and rejects on spawn error", async () => {
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      const startPromise = manager.start()
      const spawnError = new Error("spawn failed")
      mockProcess.emit("error", spawnError)

      await expect(startPromise).rejects.toThrow("spawn failed")
      expect(errors).toHaveLength(1)
      expect(manager.status).toBe("stopped")
    })
  })

  describe("stop", () => {
    it("sends SIGTERM to process", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      const stopPromise = manager.stop()
      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")
    })

    it("transitions to stopped status", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      const stopPromise = manager.stop()
      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(manager.status).toBe("stopped")
      expect(manager.isRunning).toBe(false)
    })

    it("resolves immediately if not running", async () => {
      await expect(manager.stop()).resolves.toBeUndefined()
    })

    it("force kills after timeout", async () => {
      vi.useFakeTimers()

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      const stopPromise = manager.stop(1000)
      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")

      // Advance past timeout
      vi.advanceTimersByTime(1001)
      expect(mockProcess.kill).toHaveBeenCalledWith("SIGKILL")

      // Cleanup
      mockProcess.emit("exit", null, "SIGKILL")
      await stopPromise

      vi.useRealTimers()
    })

    it("emits exit event with code and signal", async () => {
      const exits: Array<{ code: number | null; signal: string | null }> = []
      manager.on("exit", evt => exits.push(evt))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      const stopPromise = manager.stop()
      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(exits).toEqual([{ code: 0, signal: null }])
    })
  })

  describe("send", () => {
    it("writes string message to stdin", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.send("hello")
      expect(mockProcess.stdin.write).toHaveBeenCalledWith("hello\n")
    })

    it("JSON stringifies object messages", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.send({ type: "test", data: 123 })
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('{"type":"test","data":123}\n')
    })

    it("throws if not running", () => {
      expect(() => manager.send("test")).toThrow("Ralph is not running")
    })
  })

  describe("stdout parsing", () => {
    it("emits event for valid JSON lines", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      // Start collecting events after spawn
      const events: RalphEvent[] = []
      manager.on("event", evt => events.push(evt))

      mockProcess.stdout.emit("data", Buffer.from('{"type":"test","timestamp":123}\n'))

      expect(events).toEqual([{ type: "test", timestamp: 123 }])
    })

    it("handles multiple events in single chunk", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      // Start collecting events after spawn
      const events: RalphEvent[] = []
      manager.on("event", evt => events.push(evt))

      mockProcess.stdout.emit(
        "data",
        Buffer.from('{"type":"a","timestamp":1}\n{"type":"b","timestamp":2}\n'),
      )

      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({ type: "a" })
      expect(events[1]).toMatchObject({ type: "b" })
    })

    it("handles events split across chunks", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      // Start collecting events after spawn
      const events: RalphEvent[] = []
      manager.on("event", evt => events.push(evt))

      mockProcess.stdout.emit("data", Buffer.from('{"type":"split",'))
      mockProcess.stdout.emit("data", Buffer.from('"timestamp":999}\n'))

      expect(events).toEqual([{ type: "split", timestamp: 999 }])
    })

    it("emits output for non-JSON lines", async () => {
      const outputs: string[] = []
      manager.on("output", line => outputs.push(line))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      mockProcess.stdout.emit("data", Buffer.from("plain text line\n"))

      expect(outputs).toEqual(["plain text line"])
    })

    it("adds timestamp to events that are missing one", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      // Start collecting events after spawn
      const events: RalphEvent[] = []
      manager.on("event", evt => events.push(evt))

      // SDK events sometimes don't include timestamps
      mockProcess.stdout.emit("data", Buffer.from('{"type":"assistant"}\n'))

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("assistant")
      expect(typeof events[0].timestamp).toBe("number")
      // Timestamp should be recent (within last second)
      expect(events[0].timestamp).toBeGreaterThan(Date.now() - 1000)
      expect(events[0].timestamp).toBeLessThanOrEqual(Date.now())
    })

    it("preserves existing timestamp when present", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      // Start collecting events after spawn
      const events: RalphEvent[] = []
      manager.on("event", evt => events.push(evt))

      const existingTimestamp = 1706123456789
      mockProcess.stdout.emit(
        "data",
        Buffer.from(`{"type":"test","timestamp":${existingTimestamp}}\n`),
      )

      expect(events).toHaveLength(1)
      expect(events[0].timestamp).toBe(existingTimestamp)
    })
  })

  describe("stderr handling", () => {
    it("emits error for stderr output", async () => {
      const errors: Error[] = []
      manager.on("error", err => errors.push(err))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      mockProcess.stderr.emit("data", Buffer.from("Something went wrong"))

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe("stderr: Something went wrong")
    })
  })

  describe("pause", () => {
    it("sends pause command via stdin", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('{"type":"pause"}\n')
    })

    it("transitions to pausing status, then paused when event received", async () => {
      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()

      expect(manager.status).toBe("pausing")
      expect(statusChanges).toContain("pausing")

      // Simulate Ralph emitting the paused event
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))

      expect(manager.status).toBe("paused")
      expect(statusChanges).toContain("paused")
    })

    it("throws if not running", () => {
      expect(() => manager.pause()).toThrow("Ralph is not running")
    })

    it("is a no-op if already pausing or paused", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()

      // Already pausing - should be a no-op
      manager.pause()
      expect(manager.status).toBe("pausing")

      // Simulate Ralph emitting the paused event
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))
      expect(manager.status).toBe("paused")

      // Already paused - should be a no-op
      manager.pause()
      expect(manager.status).toBe("paused")
    })

    it("throws if trying to pause while stopped", () => {
      expect(() => manager.pause()).toThrow("Ralph is not running")
    })

    it("handles ralph_paused event from CLI", async () => {
      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      // Simulate Ralph emitting the paused event directly (e.g., from Ctrl-P in TTY mode)
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))

      expect(manager.status).toBe("paused")
      expect(statusChanges).toContain("paused")
    })

    it("automatically transitions to paused after timeout if Ralph doesn't respond", async () => {
      vi.useFakeTimers()

      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()
      expect(manager.status).toBe("pausing")

      // Fast-forward time by 10 seconds (the timeout duration)
      vi.advanceTimersByTime(10000)

      // Should have automatically transitioned to paused
      expect(manager.status).toBe("paused")
      expect(statusChanges).toContain("paused")

      vi.useRealTimers()
    })

    it("clears timeout when ralph_paused event is received", async () => {
      vi.useFakeTimers()

      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()
      expect(manager.status).toBe("pausing")

      // Receive the ralph_paused event before timeout
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))

      expect(manager.status).toBe("paused")

      // Fast-forward time - should not change status again since timeout was cleared
      vi.advanceTimersByTime(10000)
      expect(manager.status).toBe("paused")
      expect(statusChanges.filter(s => s === "paused")).toHaveLength(1) // Only one transition to paused

      vi.useRealTimers()
    })
  })

  describe("resume", () => {
    it("sends resume command via stdin", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()
      // Simulate Ralph emitting the paused event
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))
      manager.resume()

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('{"type":"resume"}\n')
    })

    it("transitions back to running status", async () => {
      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()
      // Simulate Ralph emitting the paused event
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))

      manager.resume()

      expect(manager.status).toBe("running")
      expect(statusChanges).toContain("running")
    })

    it("throws if not paused", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(() => manager.resume()).toThrow("Cannot resume ralph in running state")
    })

    it("throws if not running", () => {
      expect(() => manager.resume()).toThrow("Ralph is not running")
    })
  })

  describe("canAcceptMessages", () => {
    it("is false when stopped", () => {
      expect(manager.canAcceptMessages).toBe(false)
    })

    it("is true when running", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      expect(manager.canAcceptMessages).toBe(true)
    })

    it("is true when paused", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()
      // Simulate Ralph emitting the paused event
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))

      expect(manager.status).toBe("paused")
      expect(manager.isRunning).toBe(false)
      expect(manager.canAcceptMessages).toBe(true)
    })

    it("is false when stopping", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      const stopPromise = manager.stop()
      expect(manager.status).toBe("stopping")
      expect(manager.canAcceptMessages).toBe(false)

      mockProcess.emit("exit", 0, null)
      await stopPromise
    })

    it("is true when pausing", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()
      expect(manager.status).toBe("pausing")
      expect(manager.canAcceptMessages).toBe(true)
    })

    it("is true when stopping_after_current", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.stopAfterCurrent()
      expect(manager.status).toBe("stopping_after_current")
      expect(manager.canAcceptMessages).toBe(true)
    })
  })

  describe("stopAfterCurrent", () => {
    it("sends stop message to stdin", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.stopAfterCurrent()

      expect(mockProcess.stdin.write).toHaveBeenCalledWith('{"type":"stop"}\n')
    })

    it("transitions to stopping_after_current status", async () => {
      const statusChanges: string[] = []
      manager.on("status", status => statusChanges.push(status))

      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.stopAfterCurrent()

      expect(manager.status).toBe("stopping_after_current")
      expect(statusChanges).toContain("stopping_after_current")
    })

    it("throws if not running", () => {
      expect(() => manager.stopAfterCurrent()).toThrow("Ralph is not running")
    })

    it("throws if in wrong state", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      const stopPromise = manager.stop()
      mockProcess.emit("exit", 0, null)
      await stopPromise

      expect(() => manager.stopAfterCurrent()).toThrow("Ralph is not running")
    })

    it("works when paused", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.pause()
      // Simulate Ralph emitting the paused event
      mockProcess.stdout.emit("data", Buffer.from('{"type":"ralph_paused","session":1}\n'))

      manager.stopAfterCurrent()

      expect(manager.status).toBe("stopping_after_current")
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('{"type":"stop"}\n')
    })
  })

  describe("cancelStopAfterCurrent", () => {
    it("waits for exit and restarts ralph", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      manager.stopAfterCurrent()

      // Start the cancel operation (it will wait for exit)
      const cancelPromise = manager.cancelStopAfterCurrent()

      // Create a new mock process for the restart
      const newProcess = createMockProcess()
      mockSpawn.mockReturnValue(newProcess)

      // Simulate Ralph exiting
      mockProcess.emit("exit", 0, null)

      // Simulate the new process spawning
      newProcess.emit("spawn")

      await cancelPromise

      // Should have restarted and be running
      expect(manager.status).toBe("running")
    })

    it("throws if not in stopping_after_current state", async () => {
      const startPromise = manager.start()
      mockProcess.emit("spawn")
      await startPromise

      await expect(manager.cancelStopAfterCurrent()).rejects.toThrow(
        "Cannot cancel stop-after-current in running state",
      )
    })

    it("throws if not running", async () => {
      await expect(manager.cancelStopAfterCurrent()).rejects.toThrow("Ralph is not running")
    })
  })
})
