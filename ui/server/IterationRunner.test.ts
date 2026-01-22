import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventEmitter } from "node:events"
import { IterationRunner } from "./IterationRunner.js"
import type {
  AgentAdapter,
  AgentEvent,
  AgentInfo,
  AgentMessage,
  AgentStartOptions,
  AgentStatus,
} from "./AgentAdapter.js"

/**
 * Mock AgentAdapter for testing
 */
class MockAdapter extends EventEmitter implements AgentAdapter {
  _status: AgentStatus = "idle"
  startCalled = false
  stopCalled = false
  messagesSent: AgentMessage[] = []
  startOptions: AgentStartOptions | undefined

  get status(): AgentStatus {
    return this._status
  }

  get isRunning(): boolean {
    return this._status === "running"
  }

  getInfo(): AgentInfo {
    return {
      id: "mock",
      name: "Mock Agent",
      features: {
        streaming: true,
        tools: true,
        pauseResume: true,
        systemPrompt: true,
      },
    }
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async start(options?: AgentStartOptions): Promise<void> {
    this.startCalled = true
    this.startOptions = options
    this.setStatus("starting")
    // Simulate async start
    await Promise.resolve()
    this.setStatus("running")
  }

  send(message: AgentMessage): void {
    this.messagesSent.push(message)

    // Simulate handling control commands
    if (message.type === "control") {
      switch (message.command) {
        case "pause":
          this.setStatus("paused")
          break
        case "resume":
          this.setStatus("running")
          break
        case "stop":
          this.setStatus("stopping")
          setTimeout(() => {
            this.setStatus("stopped")
            this.emit("exit", { code: 0 })
          }, 10)
          break
      }
    }
  }

  async stop(force?: boolean): Promise<void> {
    this.stopCalled = true
    this.setStatus("stopping")
    // Simulate async stop
    await Promise.resolve()
    this.setStatus("stopped")
    this.emit("exit", { code: force ? 1 : 0, signal: force ? "SIGKILL" : undefined })
  }

  /**
   * Set status and emit status event
   */
  setStatus(status: AgentStatus): void {
    if (this._status !== status) {
      this._status = status
      this.emit("status", status)
    }
  }

  /**
   * Emit an agent event
   */
  emitEvent(event: AgentEvent): void {
    this.emit("event", event)
  }

  /**
   * Emit an error event
   */
  emitError(error: Error): void {
    this.emit("error", error)
  }
}

describe("IterationRunner", () => {
  let adapter: MockAdapter
  let runner: IterationRunner

  beforeEach(() => {
    adapter = new MockAdapter()
    runner = new IterationRunner({
      adapter,
      cwd: "/test/cwd",
      env: { TEST: "value" },
      systemPrompt: "Test prompt",
      model: "test-model",
      maxIterations: 5,
    })
  })

  describe("constructor", () => {
    it("creates a runner with the given adapter", () => {
      expect(runner.agentAdapter).toBe(adapter)
    })

    it("initializes with idle status", () => {
      expect(runner.status).toBe("idle")
      expect(runner.isRunning).toBe(false)
    })
  })

  describe("start", () => {
    it("starts the adapter with options", async () => {
      await runner.start()

      expect(adapter.startCalled).toBe(true)
      expect(adapter.startOptions).toEqual({
        cwd: "/test/cwd",
        env: { TEST: "value" },
        systemPrompt: "Test prompt",
        model: "test-model",
        maxIterations: 5,
      })
    })

    it("changes status to running", async () => {
      const statusChanges: string[] = []
      runner.on("status", status => statusChanges.push(status))

      await runner.start()

      expect(runner.status).toBe("running")
      expect(runner.isRunning).toBe(true)
      expect(statusChanges).toContain("running")
    })

    it("throws if already started", async () => {
      await runner.start()

      await expect(runner.start()).rejects.toThrow("already started")
    })

    it("sets status to error if start fails", async () => {
      adapter.start = vi.fn().mockRejectedValue(new Error("Start failed"))

      await expect(runner.start()).rejects.toThrow("Start failed")
      expect(runner.status).toBe("error")
    })
  })

  describe("sendMessage", () => {
    beforeEach(async () => {
      await runner.start()
    })

    it("sends a user message to the adapter", async () => {
      await runner.sendMessage("Hello!")

      expect(adapter.messagesSent).toHaveLength(1)
      expect(adapter.messagesSent[0]).toEqual({
        type: "user_message",
        content: "Hello!",
      })
    })

    it("throws if not started", async () => {
      const newRunner = new IterationRunner({ adapter: new MockAdapter() })

      await expect(newRunner.sendMessage("Hello")).rejects.toThrow("not started")
    })

    it("throws if not in running state", async () => {
      runner.pause()

      await expect(runner.sendMessage("Hello")).rejects.toThrow(
        "Cannot send message in paused state",
      )
    })
  })

  describe("pause", () => {
    beforeEach(async () => {
      await runner.start()
    })

    it("sends pause command to adapter", () => {
      runner.pause()

      expect(adapter.messagesSent).toHaveLength(1)
      expect(adapter.messagesSent[0]).toEqual({
        type: "control",
        command: "pause",
      })
    })

    it("changes status to paused", () => {
      const statusChanges: string[] = []
      runner.on("status", status => statusChanges.push(status))

      runner.pause()

      expect(runner.status).toBe("paused")
      expect(statusChanges).toContain("paused")
    })

    it("throws if not started", () => {
      const newRunner = new IterationRunner({ adapter: new MockAdapter() })

      expect(() => newRunner.pause()).toThrow("not started")
    })

    it("throws if not in running state", () => {
      runner.pause()

      expect(() => runner.pause()).toThrow("Cannot pause in paused state")
    })
  })

  describe("resume", () => {
    beforeEach(async () => {
      await runner.start()
      runner.pause()
    })

    it("sends resume command to adapter", () => {
      runner.resume()

      expect(adapter.messagesSent).toHaveLength(2) // pause + resume
      expect(adapter.messagesSent[1]).toEqual({
        type: "control",
        command: "resume",
      })
    })

    it("changes status back to running", () => {
      const statusChanges: string[] = []
      runner.on("status", status => statusChanges.push(status))

      runner.resume()

      expect(runner.status).toBe("running")
      expect(statusChanges).toContain("running")
    })

    it("throws if not started", () => {
      const newRunner = new IterationRunner({ adapter: new MockAdapter() })

      expect(() => newRunner.resume()).toThrow("not started")
    })

    it("throws if not in paused state", async () => {
      runner.resume()

      expect(() => runner.resume()).toThrow("Cannot resume in running state")
    })
  })

  describe("stop", () => {
    beforeEach(async () => {
      await runner.start()
    })

    it("stops the adapter", async () => {
      await runner.stop()

      expect(adapter.stopCalled).toBe(true)
    })

    it("changes status to stopping then stopped", async () => {
      const statusChanges: string[] = []
      runner.on("status", status => statusChanges.push(status))

      await runner.stop()

      expect(runner.status).toBe("stopped")
      expect(statusChanges).toContain("stopping")
      expect(statusChanges).toContain("stopped")
    })

    it("passes force flag to adapter", async () => {
      await runner.stop(true)

      expect(adapter.stopCalled).toBe(true)
    })

    it("does nothing if not started", async () => {
      const newRunner = new IterationRunner({ adapter: new MockAdapter() })

      await newRunner.stop()

      expect(adapter.stopCalled).toBe(false)
    })

    it("sets status to error if stop fails", async () => {
      adapter.stop = vi.fn().mockRejectedValue(new Error("Stop failed"))

      await expect(runner.stop()).rejects.toThrow("Stop failed")
      expect(runner.status).toBe("error")
    })
  })

  describe("event forwarding", () => {
    beforeEach(async () => {
      await runner.start()
    })

    it("forwards agent events", () => {
      const events: AgentEvent[] = []
      runner.on("event", event => events.push(event))

      const messageEvent: AgentEvent = {
        type: "message",
        timestamp: Date.now(),
        content: "Hello",
      }

      adapter.emitEvent(messageEvent)

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual(messageEvent)
    })

    it("forwards tool use events", () => {
      const events: AgentEvent[] = []
      runner.on("event", event => events.push(event))

      const toolEvent: AgentEvent = {
        type: "tool_use",
        timestamp: Date.now(),
        toolUseId: "tool-1",
        tool: "bash",
        input: { command: "ls" },
      }

      adapter.emitEvent(toolEvent)

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual(toolEvent)
    })

    it("emits complete on result event", () => {
      const completeEvents: Array<{ success: boolean; error?: Error }> = []
      runner.on("complete", info => completeEvents.push(info))

      const resultEvent: AgentEvent = {
        type: "result",
        timestamp: Date.now(),
        content: "Done!",
      }

      adapter.emitEvent(resultEvent)

      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0]).toEqual({ success: true })
    })

    it("emits complete with error on fatal error event", () => {
      const completeEvents: Array<{ success: boolean; error?: Error }> = []
      runner.on("complete", info => completeEvents.push(info))

      const errorEvent: AgentEvent = {
        type: "error",
        timestamp: Date.now(),
        message: "Fatal error",
        fatal: true,
      }

      adapter.emitEvent(errorEvent)

      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0].success).toBe(false)
      expect(completeEvents[0].error).toBeInstanceOf(Error)
      expect(completeEvents[0].error?.message).toBe("Fatal error")
      expect(runner.status).toBe("error")
    })

    it("does not emit complete on non-fatal error event", () => {
      const completeEvents: Array<{ success: boolean; error?: Error }> = []
      runner.on("complete", info => completeEvents.push(info))

      const errorEvent: AgentEvent = {
        type: "error",
        timestamp: Date.now(),
        message: "Non-fatal error",
        fatal: false,
      }

      adapter.emitEvent(errorEvent)

      expect(completeEvents).toHaveLength(0)
    })
  })

  describe("status forwarding", () => {
    beforeEach(async () => {
      await runner.start()
    })

    it("forwards agent status changes", () => {
      const agentStatuses: AgentStatus[] = []
      runner.on("agentStatus", status => agentStatuses.push(status))

      adapter.setStatus("paused")

      expect(agentStatuses).toContain("paused")
    })

    it("maps agent status to iteration status", () => {
      const statuses: string[] = []
      runner.on("status", status => statuses.push(status))

      adapter.setStatus("paused")
      expect(runner.status).toBe("paused")

      adapter.setStatus("running")
      expect(runner.status).toBe("running")

      adapter.setStatus("stopping")
      expect(runner.status).toBe("stopping")

      adapter.setStatus("stopped")
      expect(runner.status).toBe("stopped")
    })
  })

  describe("error forwarding", () => {
    beforeEach(async () => {
      await runner.start()
    })

    it("forwards adapter errors", () => {
      const errors: Error[] = []
      runner.on("error", error => errors.push(error))

      const testError = new Error("Test error")
      adapter.emitError(testError)

      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe(testError)
      expect(runner.status).toBe("error")
    })
  })

  describe("exit handling", () => {
    beforeEach(async () => {
      await runner.start()
    })

    it("handles successful exit", async () => {
      const completeEvents: Array<{ success: boolean; error?: Error }> = []
      runner.on("complete", info => completeEvents.push(info))

      adapter.emit("exit", { code: 0 })

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(runner.status).toBe("stopped")
      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0]).toEqual({ success: true })
    })

    it("handles exit with error code", async () => {
      const completeEvents: Array<{ success: boolean; error?: Error }> = []
      runner.on("complete", info => completeEvents.push(info))

      adapter.emit("exit", { code: 1 })

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(runner.status).toBe("stopped")
      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0].success).toBe(false)
      expect(completeEvents[0].error).toBeInstanceOf(Error)
      expect(completeEvents[0].error?.message).toContain("exited with code 1")
    })

    it("handles exit with signal", async () => {
      const completeEvents: Array<{ success: boolean; error?: Error }> = []
      runner.on("complete", info => completeEvents.push(info))

      adapter.emit("exit", { signal: "SIGTERM" })

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(runner.status).toBe("stopped")
      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0]).toEqual({ success: true })
    })
  })

  describe("integration scenarios", () => {
    it("handles full lifecycle: start -> message -> result -> stop", async () => {
      const events: AgentEvent[] = []
      const statuses: string[] = []
      const completeEvents: Array<{ success: boolean; error?: Error }> = []

      runner.on("event", event => events.push(event))
      runner.on("status", status => statuses.push(status))
      runner.on("complete", info => completeEvents.push(info))

      // Start
      await runner.start()
      expect(runner.status).toBe("running")

      // Send message
      await runner.sendMessage("Hello!")
      expect(adapter.messagesSent).toHaveLength(1)

      // Simulate agent response
      adapter.emitEvent({
        type: "message",
        timestamp: Date.now(),
        content: "Hello back!",
      })

      // Simulate result
      adapter.emitEvent({
        type: "result",
        timestamp: Date.now(),
        content: "Done",
      })

      // Stop
      await runner.stop()
      expect(runner.status).toBe("stopped")

      // Verify events
      expect(events.length).toBeGreaterThan(0)
      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0]).toEqual({ success: true })
    })

    it("handles pause and resume flow", async () => {
      await runner.start()

      // Pause
      runner.pause()
      expect(runner.status).toBe("paused")
      expect(runner.isRunning).toBe(false)

      // Resume
      runner.resume()
      expect(runner.status).toBe("running")
      expect(runner.isRunning).toBe(true)

      await runner.stop()
    })

    it("handles error during execution", async () => {
      const errors: Error[] = []
      const completeEvents: Array<{ success: boolean; error?: Error }> = []

      runner.on("error", error => errors.push(error))
      runner.on("complete", info => completeEvents.push(info))

      await runner.start()

      // Simulate fatal error
      adapter.emitEvent({
        type: "error",
        timestamp: Date.now(),
        message: "Something went wrong",
        fatal: true,
      })

      expect(runner.status).toBe("error")
      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0].success).toBe(false)
      expect(completeEvents[0].error?.message).toBe("Something went wrong")
    })
  })
})
