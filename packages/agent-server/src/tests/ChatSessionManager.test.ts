import { describe, it, expect, vi, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ChatSessionManager } from ".././ChatSessionManager.js"
import { clearRegistry, registerAdapter } from ".././AdapterRegistry.js"
import {
  AgentAdapter,
  type AgentInfo,
  type AgentStartOptions,
  type AgentMessage,
} from ".././agentTypes.js"

/** A minimal stub adapter that immediately goes idle after receiving a message. */
class StubAdapter extends AgentAdapter {
  getInfo(): AgentInfo {
    return {
      id: "stub",
      name: "Stub",
      features: { streaming: false, tools: false, pauseResume: false, systemPrompt: false },
    }
  }

  async isAvailable() {
    return true
  }

  async start(_options?: AgentStartOptions) {
    this.setStatus("running")
  }

  send(_message: AgentMessage) {
    // Simulate the adapter finishing immediately
    setTimeout(() => this.setStatus("idle"), 0)
  }

  async stop() {
    this.setStatus("stopped")
  }
}

/** A stub adapter with configurable delay to test concurrent message handling. */
class DelayedStubAdapter extends AgentAdapter {
  private delay: number
  messagesReceived: string[] = []

  constructor(delay = 50) {
    super()
    this.delay = delay
  }

  getInfo(): AgentInfo {
    return {
      id: "delayed-stub",
      name: "Delayed Stub",
      features: { streaming: false, tools: false, pauseResume: false, systemPrompt: false },
    }
  }

  async isAvailable() {
    return true
  }

  async start(_options?: AgentStartOptions) {
    this.setStatus("running")
  }

  send(message: AgentMessage) {
    if (message.type === "user_message") {
      this.messagesReceived.push(message.content)
    }
    // Simulate processing delay before going idle
    setTimeout(() => this.setStatus("idle"), this.delay)
  }

  async stop() {
    this.setStatus("stopped")
  }
}

describe("ChatSessionManager", () => {
  let storageDir: string

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "csm-test-"))

    // Set up registry with stub adapter
    clearRegistry()
    registerAdapter({
      id: "stub",
      name: "Stub",
      factory: () => new StubAdapter(),
    })
  })

  describe("sendMessage persists user_message events correctly", () => {
    it("persists user_message with `message` property, not `content`", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "stub" })

      await manager.sendMessage(sessionId, "Hello world")

      // Read back the persisted events and find the user_message
      const persister = manager.getPersister()
      const events = await persister.readEvents(sessionId)
      const userEvent = events.find(e => e.type === "user_message")

      expect(userEvent).toBeDefined()
      expect(userEvent!.message).toBe("Hello world")
      expect(userEvent!).not.toHaveProperty("content")
    })

    it("persists the correct message text for multiple messages", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "stub" })

      await manager.sendMessage(sessionId, "First message")
      await manager.sendMessage(sessionId, "Second message")

      const persister = manager.getPersister()
      const events = await persister.readEvents(sessionId)
      const userEvents = events.filter(e => e.type === "user_message")

      expect(userEvents).toHaveLength(2)
      expect(userEvents[0].message).toBe("First message")
      expect(userEvents[1].message).toBe("Second message")

      // Ensure neither event uses the old `content` property
      for (const event of userEvents) {
        expect(event).not.toHaveProperty("content")
      }
    })
  })

  describe("restoreSessions restores metadata from persisted data", () => {
    it("restores sessions with correct createdAt from session_created event", async () => {
      // Phase 1: Create a session and persist some data
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager1.createSession({ adapter: "stub" })

      // Get the original session info to compare
      const originalInfo = manager1.getSessionInfo(sessionId)
      expect(originalInfo).not.toBeNull()
      const originalCreatedAt = originalInfo!.createdAt

      // Phase 2: Create a new manager that reads from the same storage dir.
      // This triggers restoreSessions() in the constructor.
      const manager2 = new ChatSessionManager({ storageDir })

      const restoredInfo = manager2.getSessionInfo(sessionId)
      expect(restoredInfo).not.toBeNull()
      expect(restoredInfo!.createdAt).toBe(originalCreatedAt)
    })

    it("restores sessions with correct adapter from session_created event", async () => {
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager1.createSession({ adapter: "stub" })

      const manager2 = new ChatSessionManager({ storageDir })

      const restoredInfo = manager2.getSessionInfo(sessionId)
      expect(restoredInfo).not.toBeNull()
      expect(restoredInfo!.adapter).toBe("stub")
    })

    it("restores sessions with correct cwd from session_created event", async () => {
      const manager1 = new ChatSessionManager({ storageDir, cwd: "/custom/cwd" })
      const { sessionId } = await manager1.createSession({ cwd: "/project/dir" })

      const manager2 = new ChatSessionManager({ storageDir, cwd: "/different/default" })

      const restoredInfo = manager2.getSessionInfo(sessionId)
      expect(restoredInfo).not.toBeNull()
      expect(restoredInfo!.cwd).toBe("/project/dir")
    })

    it("restores multiple sessions from disk", async () => {
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId: id1 } = await manager1.createSession({ adapter: "stub" })
      const { sessionId: id2 } = await manager1.createSession({ adapter: "stub" })

      const manager2 = new ChatSessionManager({ storageDir })
      const sessions = manager2.listSessions()

      expect(sessions).toHaveLength(2)
      const restoredIds = sessions.map(s => s.sessionId).sort()
      expect(restoredIds).toEqual([id1, id2].sort())
    })

    it("falls back to defaults when session_created event is missing", () => {
      // Manually write a JSONL file without a session_created event
      const sessionId = "manual-session"
      const filePath = join(storageDir, `${sessionId}.jsonl`)
      writeFileSync(
        filePath,
        JSON.stringify({ type: "user_message", message: "Hello", timestamp: 5000 }) + "\n",
      )

      const manager = new ChatSessionManager({ storageDir, cwd: "/fallback/cwd" })
      const info = manager.getSessionInfo(sessionId)

      expect(info).not.toBeNull()
      // Falls back to defaults when metadata is null
      expect(info!.adapter).toBe("claude")
      expect(info!.cwd).toBe("/fallback/cwd")
      expect(info!.createdAt).toBe(0)
    })

    it("restored sessions have idle status", async () => {
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager1.createSession({ adapter: "stub" })

      const manager2 = new ChatSessionManager({ storageDir })

      const restoredInfo = manager2.getSessionInfo(sessionId)
      expect(restoredInfo).not.toBeNull()
      expect(restoredInfo!.status).toBe("idle")
    })
  })

  describe("message queueing", () => {
    let delayedAdapter: DelayedStubAdapter

    beforeEach(() => {
      delayedAdapter = new DelayedStubAdapter(50)
      registerAdapter({
        id: "delayed-stub",
        name: "Delayed Stub",
        factory: () => delayedAdapter,
      })
    })

    it("queues messages sent while agent is processing", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "delayed-stub" })

      // Start first message (takes 50ms to process)
      const firstPromise = manager.sendMessage(sessionId, "First message")

      // Immediately send second message while first is processing
      const secondPromise = manager.sendMessage(sessionId, "Second message")

      // Both should eventually resolve without throwing
      await expect(Promise.all([firstPromise, secondPromise])).resolves.not.toThrow()

      // Verify both messages were persisted
      const events = await manager.getPersister().readEvents(sessionId)
      const userEvents = events.filter(e => e.type === "user_message")
      expect(userEvents).toHaveLength(2)
      expect(userEvents[0].message).toBe("First message")
      expect(userEvents[1].message).toBe("Second message")
    })

    it("processes queued messages in order", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "delayed-stub" })

      // Send multiple messages in rapid succession
      const promises = [
        manager.sendMessage(sessionId, "First"),
        manager.sendMessage(sessionId, "Second"),
        manager.sendMessage(sessionId, "Third"),
      ]

      await Promise.all(promises)

      // All messages should have been received by the adapter in order
      expect(delayedAdapter.messagesReceived).toEqual(["First", "Second", "Third"])
    })

    it("returns to idle status after processing queued messages", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "delayed-stub" })

      const promises = [
        manager.sendMessage(sessionId, "First"),
        manager.sendMessage(sessionId, "Second"),
      ]

      await Promise.all(promises)

      const info = manager.getSessionInfo(sessionId)
      expect(info!.status).toBe("idle")
    })
  })
})
