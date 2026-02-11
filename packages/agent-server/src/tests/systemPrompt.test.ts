import { describe, it, expect, vi, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { ChatSessionManager } from "../ChatSessionManager.js"
import { clearRegistry, registerAdapter } from "../AdapterRegistry.js"
import {
  AgentAdapter,
  type AgentInfo,
  type AgentStartOptions,
  type AgentMessage,
} from "../agentTypes.js"

/** A minimal stub adapter that immediately goes idle after receiving a message. */
class StubAdapter extends AgentAdapter {
  lastStartOptions?: AgentStartOptions

  getInfo(): AgentInfo {
    return {
      id: "stub",
      name: "Stub",
      features: { streaming: false, tools: false, pauseResume: false, systemPrompt: true },
    }
  }

  async isAvailable() {
    return true
  }

  async start(options?: AgentStartOptions) {
    this.lastStartOptions = options
    this.setStatus("running")
  }

  send(_message: AgentMessage) {
    setTimeout(() => this.setStatus("idle"), 0)
  }

  async stop() {
    this.setStatus("stopped")
  }
}

describe("System Prompt Storage", () => {
  let storageDir: string
  let stubAdapter: StubAdapter

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "sysprompt-test-"))
    stubAdapter = new StubAdapter()

    clearRegistry()
    registerAdapter({
      id: "stub",
      name: "Stub",
      factory: () => stubAdapter,
    })
  })

  describe("createSession with systemPrompt", () => {
    it("stores system prompt when provided at session creation", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        systemPrompt: "You are a helpful coding assistant.",
      })

      const info = manager.getSessionInfo(sessionId)
      expect(info).not.toBeNull()
      expect(info!.systemPrompt).toBe("You are a helpful coding assistant.")
    })

    it("does not include systemPrompt when not provided", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
      })

      const info = manager.getSessionInfo(sessionId)
      expect(info).not.toBeNull()
      expect(info!.systemPrompt).toBeUndefined()
    })

    it("persists system prompt in session_created event", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        systemPrompt: "Test system prompt",
      })

      const persister = manager.getPersister()
      const events = await persister.readEvents(sessionId)
      const createdEvent = events.find(e => e.type === "session_created")

      expect(createdEvent).toBeDefined()
      expect(createdEvent!.systemPrompt).toBe("Test system prompt")
    })

    it("restores system prompt when session is restored from disk", async () => {
      // Phase 1: Create a session with system prompt
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager1.createSession({
        adapter: "stub",
        systemPrompt: "Persistent system prompt",
      })

      // Phase 2: Create a new manager that restores sessions from disk
      const manager2 = new ChatSessionManager({ storageDir })

      const restoredInfo = manager2.getSessionInfo(sessionId)
      expect(restoredInfo).not.toBeNull()
      expect(restoredInfo!.systemPrompt).toBe("Persistent system prompt")
    })
  })

  describe("createSession with allowedTools", () => {
    it("stores allowed tools when provided at session creation", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        allowedTools: ["Read", "Grep", "Bash"],
      })

      const info = manager.getSessionInfo(sessionId)
      expect(info).not.toBeNull()
      expect(info!.allowedTools).toEqual(["Read", "Grep", "Bash"])
    })

    it("persists allowed tools in session_created event", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        allowedTools: ["Read", "Glob", "Bash"],
      })

      const events = await manager.getPersister().readEvents(sessionId)
      const createdEvent = events.find(e => e.type === "session_created")

      expect(createdEvent).toBeDefined()
      expect(createdEvent!.allowedTools).toEqual(["Read", "Glob", "Bash"])
    })

    it("restores allowed tools when session is restored from disk", async () => {
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager1.createSession({
        adapter: "stub",
        allowedTools: ["Read", "Grep", "LS", "Bash"],
      })

      const manager2 = new ChatSessionManager({ storageDir })
      const restoredInfo = manager2.getSessionInfo(sessionId)
      expect(restoredInfo).not.toBeNull()
      expect(restoredInfo!.allowedTools).toEqual(["Read", "Grep", "LS", "Bash"])
    })
  })

  describe("sendMessage uses stored system prompt", () => {
    it("passes stored system prompt to adapter when sending message", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        systemPrompt: "Session-level system prompt",
      })

      await manager.sendMessage(sessionId, "Hello")

      // The stored system prompt should have been used
      expect(stubAdapter.lastStartOptions?.systemPrompt).toBe("Session-level system prompt")
    })

    it("allows per-message system prompt to override stored prompt", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        systemPrompt: "Session-level system prompt",
      })

      await manager.sendMessage(sessionId, "Hello", {
        systemPrompt: "Per-message override",
      })

      // The per-message system prompt should override
      expect(stubAdapter.lastStartOptions?.systemPrompt).toBe("Per-message override")
    })

    it("uses stored system prompt when per-message prompt is not provided", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        systemPrompt: "Default session prompt",
      })

      await manager.sendMessage(sessionId, "Hello", {})

      expect(stubAdapter.lastStartOptions?.systemPrompt).toBe("Default session prompt")
    })

    it("passes stored allowed tools to adapter when sending message", async () => {
      const manager = new ChatSessionManager({ storageDir })

      const { sessionId } = await manager.createSession({
        adapter: "stub",
        allowedTools: ["Read", "Grep", "Bash"],
      })

      await manager.sendMessage(sessionId, "Hello")

      expect(stubAdapter.lastStartOptions?.allowedTools).toEqual(["Read", "Grep", "Bash"])
    })
  })
})
