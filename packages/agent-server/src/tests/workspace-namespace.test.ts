import { describe, it, expect, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync, existsSync } from "node:fs"
import { join } from "node:path"
import { SessionPersister } from ".././SessionPersister.js"
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
    setTimeout(() => this.setStatus("idle"), 0)
  }

  async stop() {
    this.setStatus("stopped")
  }
}

describe("Workspace-namespaced session storage", () => {
  let storageDir: string

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "workspace-namespace-test-"))

    // Set up registry with stub adapter
    clearRegistry()
    registerAdapter({
      id: "stub",
      name: "Stub",
      factory: () => new StubAdapter(),
    })
  })

  describe("SessionPersister", () => {
    it("stores sessions in workspace/app directories", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session-1"

      await persister.appendEvent(
        sessionId,
        { type: "session_created", sessionId, timestamp: Date.now() },
        "ralph",
        "herbcaudill/ralph",
      )

      // Should create the workspace/app subdirectory structure
      expect(existsSync(join(storageDir, "herbcaudill/ralph", "ralph"))).toBe(true)
      expect(
        existsSync(join(storageDir, "herbcaudill/ralph", "ralph", `${sessionId}.jsonl`)),
      ).toBe(true)
    })

    it("stores sessions with workspace but no app", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session-ws-only"

      await persister.appendEvent(
        sessionId,
        { type: "session_created", sessionId, timestamp: Date.now() },
        undefined,
        "herbcaudill/ralph",
      )

      // Should store in workspace directory without app subdir
      expect(existsSync(join(storageDir, "herbcaudill/ralph", `${sessionId}.jsonl`))).toBe(true)
    })

    it("stores sessions with app but no workspace (backward compat)", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session-app-only"

      await persister.appendEvent(
        sessionId,
        { type: "session_created", sessionId, timestamp: Date.now() },
        "ralph",
      )

      // Should store in app directory at root (old behavior)
      expect(existsSync(join(storageDir, "ralph", `${sessionId}.jsonl`))).toBe(true)
    })

    it("lists sessions filtered by workspace and app", async () => {
      const persister = new SessionPersister(storageDir)

      // Create sessions in different workspace/app combos
      await persister.appendEvent(
        "s1",
        { type: "session_created" },
        "ralph",
        "herbcaudill/ralph",
      )
      await persister.appendEvent(
        "s2",
        { type: "session_created" },
        "ralph",
        "herbcaudill/ralph",
      )
      await persister.appendEvent(
        "s3",
        { type: "session_created" },
        "task-chat",
        "herbcaudill/ralph",
      )
      await persister.appendEvent(
        "s4",
        { type: "session_created" },
        "ralph",
        "herbcaudill/beads",
      )

      // Filter by workspace and app
      const ralphInRalph = persister.listSessions("ralph", "herbcaudill/ralph")
      expect(ralphInRalph).toHaveLength(2)
      expect(ralphInRalph).toContain("s1")
      expect(ralphInRalph).toContain("s2")

      const taskChatInRalph = persister.listSessions("task-chat", "herbcaudill/ralph")
      expect(taskChatInRalph).toHaveLength(1)
      expect(taskChatInRalph).toContain("s3")

      const ralphInBeads = persister.listSessions("ralph", "herbcaudill/beads")
      expect(ralphInBeads).toHaveLength(1)
      expect(ralphInBeads).toContain("s4")
    })

    it("listSessionsWithApp includes workspace info", async () => {
      const persister = new SessionPersister(storageDir)

      await persister.appendEvent(
        "s1",
        { type: "session_created" },
        "ralph",
        "herbcaudill/ralph",
      )
      await persister.appendEvent(
        "s2",
        { type: "session_created" },
        "task-chat",
        "herbcaudill/ralph",
      )

      const sessions = persister.listSessionsWithApp("ralph", "herbcaudill/ralph")
      expect(sessions).toHaveLength(1)
      expect(sessions[0].sessionId).toBe("s1")
      expect(sessions[0].app).toBe("ralph")
      expect(sessions[0].workspace).toBe("herbcaudill/ralph")
    })

    it("reads events from workspace-namespaced session", async () => {
      const persister = new SessionPersister(storageDir)
      const workspace = "herbcaudill/ralph"

      await persister.appendEvent(
        "s1",
        { type: "session_created", timestamp: 1000 },
        "ralph",
        workspace,
      )
      await persister.appendEvent(
        "s1",
        { type: "user_message", message: "Hello", timestamp: 2000 },
        "ralph",
        workspace,
      )

      const events = await persister.readEvents("s1", "ralph", workspace)
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe("session_created")
      expect(events[1].type).toBe("user_message")
    })

    it("reads session metadata from workspace-namespaced session", async () => {
      const persister = new SessionPersister(storageDir)
      const workspace = "herbcaudill/ralph"
      const createdAt = Date.now()

      await persister.appendEvent(
        "s1",
        {
          type: "session_created",
          sessionId: "s1",
          adapter: "stub",
          cwd: "/test/dir",
          timestamp: createdAt,
        },
        "ralph",
        workspace,
      )

      const metadata = persister.readSessionMetadata("s1", "ralph", workspace)
      expect(metadata).not.toBeNull()
      expect(metadata!.adapter).toBe("stub")
      expect(metadata!.cwd).toBe("/test/dir")
      expect(metadata!.createdAt).toBe(createdAt)
    })

    it("deletes session from workspace-namespaced directory", async () => {
      const persister = new SessionPersister(storageDir)
      const workspace = "herbcaudill/ralph"

      await persister.appendEvent("s1", { type: "session_created" }, "ralph", workspace)
      expect(persister.hasSession("s1", "ralph", workspace)).toBe(true)

      persister.deleteSession("s1", "ralph", workspace)
      expect(persister.hasSession("s1", "ralph", workspace)).toBe(false)
    })

    it("readEventsSince works with workspace", async () => {
      const persister = new SessionPersister(storageDir)
      const workspace = "herbcaudill/ralph"

      await persister.appendEvent(
        "s1",
        { type: "session_created", timestamp: 1000 },
        "ralph",
        workspace,
      )
      await persister.appendEvent(
        "s1",
        { type: "user_message", message: "Hello", timestamp: 2000 },
        "ralph",
        workspace,
      )
      await persister.appendEvent(
        "s1",
        { type: "assistant_message", text: "Hi!", timestamp: 3000 },
        "ralph",
        workspace,
      )

      const events = await persister.readEventsSince("s1", 2000, "ralph", workspace)
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe("user_message")
      expect(events[1].type).toBe("assistant_message")
    })
  })

  describe("ChatSessionManager", () => {
    it("creates sessions with workspace derived from cwd", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({
        adapter: "stub",
        app: "ralph",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
      })

      const info = manager.getSessionInfo(sessionId)
      expect(info).not.toBeNull()
      expect(info!.app).toBe("ralph")
      expect(info!.workspace).toBe("herbcaudill/ralph")

      // Verify file is in the workspace/app directory
      expect(
        existsSync(join(storageDir, "herbcaudill/ralph", "ralph", `${sessionId}.jsonl`)),
      ).toBe(true)
    })

    it("lists sessions filtered by workspace", async () => {
      const manager = new ChatSessionManager({ storageDir })

      await manager.createSession({
        adapter: "stub",
        app: "ralph",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
      })
      await manager.createSession({
        adapter: "stub",
        app: "ralph",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/beads",
      })
      await manager.createSession({
        adapter: "stub",
        app: "task-chat",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
      })

      const ralphWsSessions = manager.listSessions("ralph", "herbcaudill/ralph")
      expect(ralphWsSessions).toHaveLength(1)
      expect(ralphWsSessions[0].app).toBe("ralph")

      const beadsWsSessions = manager.listSessions("ralph", "herbcaudill/beads")
      expect(beadsWsSessions).toHaveLength(1)
    })

    it("restores sessions with workspace from persisted data", async () => {
      // Phase 1: Create sessions
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager1.createSession({
        adapter: "stub",
        app: "ralph",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
      })

      // Phase 2: Create new manager that restores from disk
      const manager2 = new ChatSessionManager({ storageDir })
      const info = manager2.getSessionInfo(sessionId)

      expect(info).not.toBeNull()
      expect(info!.app).toBe("ralph")
      expect(info!.workspace).toBe("herbcaudill/ralph")
    })

    it("clears session from workspace-namespaced directory", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({
        adapter: "stub",
        app: "ralph",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/ralph",
      })

      expect(
        existsSync(join(storageDir, "herbcaudill/ralph", "ralph", `${sessionId}.jsonl`)),
      ).toBe(true)

      await manager.clearSession(sessionId)

      expect(
        existsSync(join(storageDir, "herbcaudill/ralph", "ralph", `${sessionId}.jsonl`)),
      ).toBe(false)
    })
  })
})
