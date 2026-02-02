import { describe, it, expect, vi, beforeEach } from "vitest"
import { RalphManager, type RalphStatus, type RalphEvent } from "./RalphManager.js"
import { EventEmitter } from "node:events"

/**
 * Create a mock spawn function that returns a fake child process.
 * The returned emitter can be used to simulate process lifecycle events.
 */
function createMockSpawn() {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: { writable: boolean; write: ReturnType<typeof vi.fn> }
    stdout: EventEmitter
    stderr: EventEmitter
    kill: ReturnType<typeof vi.fn>
    pid: number
  }
  proc.stdin = { writable: true, write: vi.fn() }
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn((signal?: string) => {
    proc.emit("exit", signal === "SIGKILL" ? 1 : 0, signal ?? "SIGTERM")
  })
  proc.pid = 12345

  const spawnFn = vi.fn().mockReturnValue(proc)

  return { spawnFn, proc }
}

describe("RalphManager", () => {
  let manager: RalphManager
  let mockSpawn: ReturnType<typeof createMockSpawn>

  beforeEach(() => {
    mockSpawn = createMockSpawn()
    manager = new RalphManager({
      command: "test-command",
      args: ["--json"],
      cwd: "/tmp/test",
      spawn: mockSpawn.spawnFn,
    })
  })

  it("can be instantiated with default options", () => {
    const m = new RalphManager()
    expect(m).toBeInstanceOf(RalphManager)
    expect(m.status).toBe("stopped")
    expect(m.isRunning).toBe(false)
    expect(m.canAcceptMessages).toBe(false)
  })

  it("can be instantiated with custom options", () => {
    expect(manager).toBeInstanceOf(RalphManager)
    expect(manager.status).toBe("stopped")
  })

  describe("start", () => {
    it("spawns a process and transitions to running", async () => {
      const startPromise = manager.start()

      // Simulate the process spawning
      mockSpawn.proc.emit("spawn")

      await startPromise

      expect(manager.status).toBe("running")
      expect(manager.isRunning).toBe(true)
      expect(mockSpawn.spawnFn).toHaveBeenCalledWith(
        "test-command",
        ["--json"],
        expect.objectContaining({
          cwd: "/tmp/test",
          stdio: ["pipe", "pipe", "pipe"],
        }),
      )
    })

    it("emits status events during start", async () => {
      const statuses: RalphStatus[] = []
      manager.on("status", (s: RalphStatus) => statuses.push(s))

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      expect(statuses).toEqual(["starting", "running"])
    })

    it("throws if already running", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      await expect(manager.start()).rejects.toThrow("already running")
    })

    it("adds --watch flag when watch option is set", async () => {
      const m = new RalphManager({
        command: "test",
        args: ["--json"],
        cwd: "/tmp",
        spawn: mockSpawn.spawnFn,
        watch: true,
      })

      const startPromise = m.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      expect(mockSpawn.spawnFn).toHaveBeenCalledWith(
        "test",
        ["--json", "--watch"],
        expect.any(Object),
      )
    })

    it("adds session count argument", async () => {
      const startPromise = manager.start(5)
      mockSpawn.proc.emit("spawn")
      await startPromise

      expect(mockSpawn.spawnFn).toHaveBeenCalledWith(
        "test-command",
        ["--json", "5"],
        expect.any(Object),
      )
    })

    it("adds --agent flag for non-claude agents", async () => {
      const m = new RalphManager({
        command: "test",
        args: ["--json"],
        cwd: "/tmp",
        spawn: mockSpawn.spawnFn,
        agent: "codex",
      })

      const startPromise = m.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      expect(mockSpawn.spawnFn).toHaveBeenCalledWith(
        "test",
        ["--json", "--agent", "codex"],
        expect.any(Object),
      )
    })
  })

  describe("stdout parsing", () => {
    it("parses JSON events from stdout", async () => {
      const events: RalphEvent[] = []
      manager.on("event", (e: RalphEvent) => events.push(e))

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      const event = { type: "message", content: "hello", timestamp: 1000 }
      mockSpawn.proc.stdout.emit("data", Buffer.from(JSON.stringify(event) + "\n"))

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("message")
      expect(events[0].content).toBe("hello")
    })

    it("emits output for non-JSON lines", async () => {
      const outputs: string[] = []
      manager.on("output", (line: string) => outputs.push(line))

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      mockSpawn.proc.stdout.emit("data", Buffer.from("not json\n"))

      expect(outputs).toEqual(["not json"])
    })

    it("handles buffered/split JSON across multiple chunks", async () => {
      const events: RalphEvent[] = []
      manager.on("event", (e: RalphEvent) => events.push(e))

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      const event = { type: "test", timestamp: 123 }
      const json = JSON.stringify(event) + "\n"

      // Split across two chunks
      mockSpawn.proc.stdout.emit("data", Buffer.from(json.slice(0, 5)))
      mockSpawn.proc.stdout.emit("data", Buffer.from(json.slice(5)))

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("test")
    })

    it("adds timestamp if missing from event", async () => {
      const events: RalphEvent[] = []
      manager.on("event", (e: RalphEvent) => events.push(e))

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      mockSpawn.proc.stdout.emit("data", Buffer.from('{"type":"test"}\n'))

      expect(events).toHaveLength(1)
      expect(events[0].timestamp).toBeTypeOf("number")
      expect(events[0].timestamp).toBeGreaterThan(0)
    })
  })

  describe("pause/resume", () => {
    it("transitions to pausing then paused on ralph_paused event", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      manager.pause()
      expect(manager.status).toBe("pausing")

      // Simulate ralph_paused event
      mockSpawn.proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ type: "ralph_paused", timestamp: Date.now() }) + "\n"),
      )

      expect(manager.status).toBe("paused")
    })

    it("can resume from paused state", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      manager.pause()
      mockSpawn.proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ type: "ralph_paused", timestamp: Date.now() }) + "\n"),
      )

      expect(manager.status).toBe("paused")

      manager.resume()
      expect(manager.status).toBe("running")
      expect(mockSpawn.proc.stdin.write).toHaveBeenCalled()
    })

    it("throws when pausing a non-running manager", () => {
      expect(() => manager.pause()).toThrow("not running")
    })

    it("throws when resuming a non-paused manager", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      expect(() => manager.resume()).toThrow("Cannot resume")
    })

    it("canAcceptMessages is true in running, paused, pausing, and stopping_after_current states", async () => {
      expect(manager.canAcceptMessages).toBe(false)

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      expect(manager.canAcceptMessages).toBe(true) // running

      manager.pause()
      expect(manager.canAcceptMessages).toBe(true) // pausing

      mockSpawn.proc.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ type: "ralph_paused", timestamp: Date.now() }) + "\n"),
      )
      expect(manager.canAcceptMessages).toBe(true) // paused
    })
  })

  describe("stopAfterCurrent", () => {
    it("transitions to stopping_after_current", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      manager.stopAfterCurrent()
      expect(manager.status).toBe("stopping_after_current")
    })

    it("throws when not running or paused", () => {
      expect(() => manager.stopAfterCurrent()).toThrow("not running")
    })
  })

  describe("stop", () => {
    it("kills the process and transitions to stopped", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      await manager.stop()

      expect(manager.status).toBe("stopped")
      expect(manager.isRunning).toBe(false)
      expect(mockSpawn.proc.kill).toHaveBeenCalledWith("SIGTERM")
    })

    it("is a no-op when not running", async () => {
      await expect(manager.stop()).resolves.toBeUndefined()
    })
  })

  describe("send", () => {
    it("sends JSON messages to stdin", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      manager.send({ type: "message", text: "hello" })

      expect(mockSpawn.proc.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"message"'),
      )
    })

    it("sends string messages to stdin", async () => {
      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      manager.send("raw message")

      expect(mockSpawn.proc.stdin.write).toHaveBeenCalledWith("raw message\n")
    })

    it("throws when not running", () => {
      expect(() => manager.send("test")).toThrow("not running")
    })
  })

  describe("process exit", () => {
    it("transitions to stopped and emits exit", async () => {
      const exitInfo: Array<{ code: number | null; signal: string | null }> = []
      manager.on("exit", (info: { code: number | null; signal: string | null }) =>
        exitInfo.push(info),
      )

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      mockSpawn.proc.emit("exit", 0, null)

      expect(manager.status).toBe("stopped")
      expect(exitInfo).toHaveLength(1)
    })
  })

  describe("stderr", () => {
    it("emits errors from stderr", async () => {
      const errors: Error[] = []
      manager.on("error", (e: Error) => errors.push(e))

      const startPromise = manager.start()
      mockSpawn.proc.emit("spawn")
      await startPromise

      mockSpawn.proc.stderr.emit("data", Buffer.from("something went wrong"))

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toContain("something went wrong")
    })
  })
})
