import { describe, it, expect, vi, beforeEach } from "vitest"
import { SessionRunner, type SessionStatus } from "./SessionRunner.js"
import { AgentAdapter, type AgentInfo, type AgentStartOptions, type AgentMessage } from "./agentTypes.js"

/**
 * Concrete mock implementation of AgentAdapter for testing.
 */
class MockAgentAdapter extends AgentAdapter {
  startCalled = false
  stopCalled = false
  sentMessages: AgentMessage[] = []

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

  async start(_options?: AgentStartOptions): Promise<void> {
    this.startCalled = true
    this.setStatus("running")
  }

  send(message: AgentMessage): void {
    this.sentMessages.push(message)
  }

  async stop(_force?: boolean): Promise<void> {
    this.stopCalled = true
    this.setStatus("stopped")
  }
}

describe("SessionRunner", () => {
  let adapter: MockAgentAdapter
  let runner: SessionRunner

  beforeEach(() => {
    adapter = new MockAgentAdapter()
    runner = new SessionRunner({
      adapter,
      cwd: "/tmp/test",
      systemPrompt: "test prompt",
    })
  })

  it("can be instantiated", () => {
    expect(runner).toBeInstanceOf(SessionRunner)
    expect(runner.status).toBe("idle")
    expect(runner.isRunning).toBe(false)
    expect(runner.agentAdapter).toBe(adapter)
  })

  describe("start", () => {
    it("starts the agent and transitions to running", async () => {
      await runner.start()

      expect(adapter.startCalled).toBe(true)
      expect(runner.status).toBe("running")
      expect(runner.isRunning).toBe(true)
    })

    it("emits status events during start", async () => {
      const statuses: SessionStatus[] = []
      runner.on("status", (s: SessionStatus) => statuses.push(s))

      await runner.start()

      expect(statuses).toContain("running")
    })

    it("throws if already started", async () => {
      await runner.start()
      await expect(runner.start()).rejects.toThrow("already started")
    })

    it("transitions to error if adapter start fails", async () => {
      adapter.start = async () => {
        throw new Error("start failed")
      }

      await expect(runner.start()).rejects.toThrow("start failed")
      expect(runner.status).toBe("error")
    })
  })

  describe("sendMessage", () => {
    it("sends a user message to the adapter", async () => {
      await runner.start()
      await runner.sendMessage("hello")

      expect(adapter.sentMessages).toHaveLength(1)
      expect(adapter.sentMessages[0]).toEqual({
        type: "user_message",
        content: "hello",
      })
    })

    it("throws if not started", async () => {
      await expect(runner.sendMessage("hello")).rejects.toThrow("not started")
    })
  })

  describe("pause/resume", () => {
    it("pauses and resumes", async () => {
      await runner.start()

      runner.pause()
      expect(runner.status).toBe("paused")
      expect(adapter.sentMessages).toHaveLength(1)
      expect(adapter.sentMessages[0]).toEqual({
        type: "control",
        command: "pause",
      })

      runner.resume()
      expect(runner.status).toBe("running")
      expect(adapter.sentMessages).toHaveLength(2)
      expect(adapter.sentMessages[1]).toEqual({
        type: "control",
        command: "resume",
      })
    })

    it("throws when pausing if not running", () => {
      expect(() => runner.pause()).toThrow("not started")
    })

    it("throws when resuming if not paused", async () => {
      await runner.start()
      expect(() => runner.resume()).toThrow("Cannot resume")
    })
  })

  describe("stop", () => {
    it("stops the agent", async () => {
      await runner.start()
      await runner.stop()

      expect(adapter.stopCalled).toBe(true)
      expect(runner.status).toBe("stopped")
      expect(runner.isRunning).toBe(false)
    })

    it("is a no-op when not started", async () => {
      await expect(runner.stop()).resolves.toBeUndefined()
    })
  })

  describe("event forwarding", () => {
    it("forwards agent events", async () => {
      const events: Array<{ type: string }> = []

      await runner.start()

      // Start listening after start() to avoid capturing the initial status event
      runner.on("event", (e: { type: string }) => events.push(e))

      adapter.emit("event", { type: "message", content: "test", timestamp: Date.now() })

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("message")
    })

    it("emits complete on result event", async () => {
      const completeHandler = vi.fn()
      runner.on("complete", completeHandler)

      await runner.start()

      adapter.emit("event", { type: "result", timestamp: Date.now() })

      expect(completeHandler).toHaveBeenCalledWith({ success: true })
    })

    it("emits complete with error on fatal error event", async () => {
      const completeHandler = vi.fn()
      runner.on("complete", completeHandler)

      await runner.start()

      adapter.emit("event", {
        type: "error",
        fatal: true,
        message: "something broke",
        timestamp: Date.now(),
      })

      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      )
    })

    it("emits complete on agent exit with non-zero code", async () => {
      const completeHandler = vi.fn()
      runner.on("complete", completeHandler)

      await runner.start()

      adapter.emit("exit", { code: 1 })

      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      )
    })

    it("forwards adapter status changes", async () => {
      const agentStatuses: string[] = []
      runner.on("agentStatus", (s: string) => agentStatuses.push(s))

      await runner.start()

      adapter.emit("status", "paused")

      expect(agentStatuses).toContain("paused")
    })

    it("forwards adapter errors", async () => {
      const errors: Error[] = []
      runner.on("error", (e: Error) => errors.push(e))

      await runner.start()

      adapter.emit("error", new Error("adapter error"))

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe("adapter error")
      expect(runner.status).toBe("error")
    })
  })
})
