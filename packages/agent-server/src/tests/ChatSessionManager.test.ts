import { describe, it, expect, vi, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync } from "node:fs"
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
})
