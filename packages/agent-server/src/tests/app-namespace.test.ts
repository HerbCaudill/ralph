import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import express from "express"
import { WebSocketServer, WebSocket } from "ws"
import { createServer, type Server as HttpServer } from "node:http"
import { SessionPersister } from ".././SessionPersister.js"
import { ChatSessionManager } from ".././ChatSessionManager.js"
import { clearRegistry, registerAdapter } from ".././AdapterRegistry.js"
import { registerRoutes, type RouteContext } from ".././routes.js"
import { handleWsConnection, type WsClient } from ".././wsHandler.js"
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

/** Create a mock RouteContext with the given overrides. */
function createMockContext(overrides?: {
  persister?: Partial<SessionPersister>
  sessionManager?: Partial<ChatSessionManager>
}): RouteContext {
  const persister = {
    getLatestSessionId: vi.fn().mockReturnValue("latest-session-abc"),
    readEvents: vi.fn().mockResolvedValue([]),
    readEventsSince: vi.fn().mockResolvedValue([]),
    listSessions: vi.fn().mockReturnValue([]),
    ...overrides?.persister,
  }

  const sessionManager = {
    getPersister: vi.fn().mockReturnValue(persister),
    getSessionInfo: vi.fn().mockImplementation((id: string) => ({
      sessionId: id,
      adapter: "stub",
      status: "idle" as const,
      createdAt: Date.now(),
      app: "test-app",
    })),
    listSessions: vi.fn().mockReturnValue([]),
    createSession: vi.fn().mockResolvedValue({ sessionId: "new-session" }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    clearSession: vi.fn().mockResolvedValue(undefined),
    ...overrides?.sessionManager,
  }

  return {
    getSessionManager: () => sessionManager as unknown as ChatSessionManager,
  }
}

/** Create an express app with routes registered and return a helper for making requests. */
function createTestApp(ctx?: RouteContext) {
  const app = express()
  app.use(express.json())
  registerRoutes(app, ctx ?? createMockContext())
  return app
}

/** Make a request to the test app and return the parsed response. */
async function request(
  app: express.Express,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
) {
  const server = app.listen(0)
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0

  try {
    const url = `http://127.0.0.1:${port}${path}`
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    return { status: res.status, body: json }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

describe("App-namespaced session storage", () => {
  let storageDir: string

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "app-namespace-test-"))

    // Set up registry with stub adapter
    clearRegistry()
    registerAdapter({
      id: "stub",
      name: "Stub",
      factory: () => new StubAdapter(),
    })
  })

  describe("SessionPersister", () => {
    it("stores sessions in app-namespaced directories", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session-1"
      const app = "ralph"

      await persister.appendEvent(
        sessionId,
        {
          type: "session_created",
          sessionId,
          timestamp: Date.now(),
        },
        app,
      )

      // Should create the app subdirectory
      expect(existsSync(join(storageDir, "ralph"))).toBe(true)
      expect(existsSync(join(storageDir, "ralph", `${sessionId}.jsonl`))).toBe(true)
    })

    it("stores sessions without app in root directory", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session-no-app"

      await persister.appendEvent(sessionId, {
        type: "session_created",
        sessionId,
        timestamp: Date.now(),
      })

      // Should store directly in storageDir
      expect(existsSync(join(storageDir, `${sessionId}.jsonl`))).toBe(true)
    })

    it("lists sessions filtered by app", async () => {
      const persister = new SessionPersister(storageDir)

      // Create sessions in different apps
      await persister.appendEvent("session-ralph-1", { type: "session_created" }, "ralph")
      await persister.appendEvent("session-ralph-2", { type: "session_created" }, "ralph")
      await persister.appendEvent("session-task-1", { type: "session_created" }, "task-chat")
      await persister.appendEvent("session-no-app", { type: "session_created" })

      // Filter by app
      const ralphSessions = persister.listSessions("ralph")
      expect(ralphSessions).toHaveLength(2)
      expect(ralphSessions).toContain("session-ralph-1")
      expect(ralphSessions).toContain("session-ralph-2")

      const taskSessions = persister.listSessions("task-chat")
      expect(taskSessions).toHaveLength(1)
      expect(taskSessions).toContain("session-task-1")

      // Without app filter, list all sessions
      const allSessions = persister.listSessions()
      expect(allSessions).toHaveLength(4)
    })

    it("reads events from app-namespaced session", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session"
      const app = "ralph"

      await persister.appendEvent(
        sessionId,
        {
          type: "session_created",
          sessionId,
          timestamp: 1000,
        },
        app,
      )
      await persister.appendEvent(
        sessionId,
        {
          type: "user_message",
          message: "Hello",
          timestamp: 2000,
        },
        app,
      )

      const events = await persister.readEvents(sessionId, app)
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe("session_created")
      expect(events[1].type).toBe("user_message")
    })

    it("reads session metadata from app-namespaced session", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session"
      const app = "ralph"
      const createdAt = Date.now()

      await persister.appendEvent(
        sessionId,
        {
          type: "session_created",
          sessionId,
          adapter: "stub",
          cwd: "/test/dir",
          timestamp: createdAt,
        },
        app,
      )

      const metadata = persister.readSessionMetadata(sessionId, app)
      expect(metadata).not.toBeNull()
      expect(metadata!.adapter).toBe("stub")
      expect(metadata!.cwd).toBe("/test/dir")
      expect(metadata!.createdAt).toBe(createdAt)
    })

    it("deletes session from app-namespaced directory", async () => {
      const persister = new SessionPersister(storageDir)
      const sessionId = "test-session"
      const app = "ralph"

      await persister.appendEvent(sessionId, { type: "session_created" }, app)
      expect(persister.hasSession(sessionId, app)).toBe(true)

      persister.deleteSession(sessionId, app)
      expect(persister.hasSession(sessionId, app)).toBe(false)
    })
  })

  describe("ChatSessionManager", () => {
    it("creates sessions with app namespace", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "stub", app: "ralph" })

      const info = manager.getSessionInfo(sessionId)
      expect(info).not.toBeNull()
      expect(info!.app).toBe("ralph")

      // Verify file exists via persister (path includes workspace derived from cwd)
      const persister = manager.getPersister()
      expect(persister.hasSession(sessionId, "ralph", info!.workspace)).toBe(true)
    })

    it("creates sessions without app in workspace directory", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "stub" })

      const info = manager.getSessionInfo(sessionId)
      expect(info).not.toBeNull()
      expect(info!.app).toBeUndefined()
      // Workspace is always derived from cwd
      expect(info!.workspace).toBeDefined()

      // Verify file exists via persister
      const persister = manager.getPersister()
      expect(persister.hasSession(sessionId, undefined, info!.workspace)).toBe(true)
    })

    it("lists sessions filtered by app", async () => {
      const manager = new ChatSessionManager({ storageDir })

      await manager.createSession({ adapter: "stub", app: "ralph" })
      await manager.createSession({ adapter: "stub", app: "ralph" })
      await manager.createSession({ adapter: "stub", app: "task-chat" })
      await manager.createSession({ adapter: "stub" })

      const ralphSessions = manager.listSessions("ralph")
      expect(ralphSessions).toHaveLength(2)
      expect(ralphSessions.every(s => s.app === "ralph")).toBe(true)

      const taskSessions = manager.listSessions("task-chat")
      expect(taskSessions).toHaveLength(1)
      expect(taskSessions[0].app).toBe("task-chat")

      const allSessions = manager.listSessions()
      expect(allSessions).toHaveLength(4)
    })

    it("restores sessions with app from persisted data", async () => {
      // Phase 1: Create sessions
      const manager1 = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager1.createSession({ adapter: "stub", app: "ralph" })

      // Phase 2: Create new manager that restores from disk
      const manager2 = new ChatSessionManager({ storageDir })
      const info = manager2.getSessionInfo(sessionId)

      expect(info).not.toBeNull()
      expect(info!.app).toBe("ralph")
    })

    it("clears session from app-namespaced directory", async () => {
      const manager = new ChatSessionManager({ storageDir })
      const { sessionId } = await manager.createSession({ adapter: "stub", app: "ralph" })

      const info = manager.getSessionInfo(sessionId)!
      const persister = manager.getPersister()
      expect(persister.hasSession(sessionId, "ralph", info.workspace)).toBe(true)

      await manager.clearSession(sessionId)

      expect(persister.hasSession(sessionId, "ralph", info.workspace)).toBe(false)
    })
  })

  describe("routes", () => {
    it("GET /api/sessions returns all sessions without filter", async () => {
      const ctx = createMockContext({
        sessionManager: {
          listSessions: vi.fn().mockReturnValue([
            { sessionId: "s1", app: "ralph", adapter: "stub", status: "idle", createdAt: 1000 },
            { sessionId: "s2", app: "task-chat", adapter: "stub", status: "idle", createdAt: 2000 },
            { sessionId: "s3", adapter: "stub", status: "idle", createdAt: 3000 },
          ]),
        },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions")

      expect(res.status).toBe(200)
      expect(res.body.sessions).toHaveLength(3)
    })

    it("GET /api/sessions?app=ralph filters sessions by app", async () => {
      const listSessions = vi.fn().mockImplementation((app?: string) => {
        const allSessions = [
          { sessionId: "s1", app: "ralph", adapter: "stub", status: "idle", createdAt: 1000 },
          { sessionId: "s2", app: "ralph", adapter: "stub", status: "idle", createdAt: 2000 },
          { sessionId: "s3", app: "task-chat", adapter: "stub", status: "idle", createdAt: 3000 },
        ]
        if (app) {
          return allSessions.filter(s => s.app === app)
        }
        return allSessions
      })

      const ctx = createMockContext({
        sessionManager: { listSessions },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions?app=ralph")

      expect(res.status).toBe(200)
      expect(listSessions).toHaveBeenCalledWith("ralph")
    })

    it("POST /api/sessions creates session with app", async () => {
      const createSession = vi.fn().mockResolvedValue({ sessionId: "new-session" })
      const ctx = createMockContext({
        sessionManager: { createSession },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "POST", "/api/sessions", { adapter: "stub", app: "ralph" })

      expect(res.status).toBe(201)
      expect(createSession).toHaveBeenCalledWith({ adapter: "stub", app: "ralph" })
    })

    it("POST /api/sessions forwards allowedTools to session creation", async () => {
      const createSession = vi.fn().mockResolvedValue({ sessionId: "new-session" })
      const ctx = createMockContext({
        sessionManager: { createSession },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "POST", "/api/sessions", {
        adapter: "stub",
        app: "task-chat",
        allowedTools: ["Read", "Grep", "Bash"],
      })

      expect(res.status).toBe(201)
      expect(createSession).toHaveBeenCalledWith({
        adapter: "stub",
        app: "task-chat",
        allowedTools: ["Read", "Grep", "Bash"],
      })
    })

    it("GET /api/sessions/:id/events reads events from app-namespaced session", async () => {
      // This test verifies the bug fix for r-vq4gx:
      // When fetching events for a session with an app namespace (e.g., "ralph"),
      // the endpoint must include the app parameter to find events stored in
      // the app's subdirectory.
      const readEvents = vi.fn().mockResolvedValue([
        { type: "user_message", message: "Hello", timestamp: 1000 },
        { type: "assistant_message", text: "Hi!", timestamp: 2000 },
      ])
      const readEventsSince = vi
        .fn()
        .mockResolvedValue([{ type: "assistant_message", text: "Hi!", timestamp: 2000 }])

      const ctx = createMockContext({
        persister: { readEvents, readEventsSince },
        sessionManager: {
          getSessionInfo: vi.fn().mockImplementation((id: string) => ({
            sessionId: id,
            adapter: "stub",
            status: "idle" as const,
            createdAt: Date.now(),
            app: "ralph",
          })),
        },
      })
      const app = createTestApp(ctx)

      // Test reading all events (no since param)
      const res1 = await request(app, "GET", "/api/sessions/test-session/events")
      expect(res1.status).toBe(200)
      expect(res1.body.events).toHaveLength(2)
      expect(readEvents).toHaveBeenCalledWith("test-session", "ralph", undefined)

      // Test reading events since timestamp
      const res2 = await request(app, "GET", "/api/sessions/test-session/events?since=1500")
      expect(res2.status).toBe(200)
      expect(res2.body.events).toHaveLength(1)
      expect(readEventsSince).toHaveBeenCalledWith("test-session", 1500, "ralph", undefined)
    })
  })

  describe("WebSocket reconnect", () => {
    it("reads events from app-namespaced session on reconnect", async () => {
      // This test verifies the bug fix for r-ztbkf:
      // When reconnecting to a session with an app namespace (e.g., "ralph"),
      // the persister.readEvents call must include the app parameter to find
      // events stored in the app's subdirectory.
      const persister = new SessionPersister(storageDir)
      const manager = new ChatSessionManager({ storageDir })

      // Create a session with app namespace
      const { sessionId } = await manager.createSession({ adapter: "stub", app: "ralph" })
      const sessionInfo = manager.getSessionInfo(sessionId)!

      // Manually append some events to simulate a session that was running
      await persister.appendEvent(
        sessionId,
        { type: "user_message", message: "Hello", timestamp: 1000 },
        "ralph",
        sessionInfo.workspace,
      )
      await persister.appendEvent(
        sessionId,
        { type: "assistant_message", text: "Hi there!", timestamp: 2000 },
        "ralph",
        sessionInfo.workspace,
      )

      // Simulate what the reconnect handler does: get session info and read events
      expect(sessionInfo).not.toBeNull()
      expect(sessionInfo.app).toBe("ralph")

      // The bug was: reconnect handler called readEvents(sessionId) without app
      // This would return empty array because the file is in ralph/ subdirectory
      const eventsWithoutApp = await persister.readEvents(sessionId)
      expect(eventsWithoutApp).toHaveLength(0) // Bug: events not found!

      // The fix: pass the app and workspace parameters from session info
      const eventsWithApp = await persister.readEvents(
        sessionId,
        sessionInfo.app,
        sessionInfo.workspace,
      )
      // Skip the session_created event (first event), we added 2 more
      expect(eventsWithApp.length).toBeGreaterThanOrEqual(2)
      expect(eventsWithApp.some(e => e.type === "user_message")).toBe(true)
      expect(eventsWithApp.some(e => e.type === "assistant_message")).toBe(true)
    })
  })

  describe("WebSocket reconnect", () => {
    let httpServer: HttpServer
    let wss: WebSocketServer
    let manager: ChatSessionManager
    let wsClients: Set<WsClient>
    let serverPort: number

    beforeEach(async () => {
      manager = new ChatSessionManager({ storageDir })
      wsClients = new Set()

      httpServer = createServer()
      wss = new WebSocketServer({ server: httpServer })

      wss.on("connection", ws => {
        handleWsConnection(ws, wsClients, {
          getSessionManager: () => manager,
        })
      })

      await new Promise<void>(resolve => {
        httpServer.listen(0, () => {
          const addr = httpServer.address()
          serverPort = typeof addr === "object" && addr ? addr.port : 0
          resolve()
        })
      })
    })

    afterEach(async () => {
      wss.close()
      await new Promise<void>(resolve => httpServer.close(() => resolve()))
    })

    it("reconnect should return events for app-namespaced sessions", async () => {
      // Create a session with app="ralph" and add some events
      const { sessionId } = await manager.createSession({ adapter: "stub", app: "ralph" })
      const info = manager.getSessionInfo(sessionId)!

      // Simulate some events being persisted (must include workspace to match session storage)
      const persister = manager.getPersister()
      await persister.appendEvent(
        sessionId,
        { type: "user_message", message: "Hello", timestamp: 1000 },
        "ralph",
        info.workspace,
      )
      await persister.appendEvent(
        sessionId,
        { type: "assistant_message", message: "Hi there!", timestamp: 2000 },
        "ralph",
        info.workspace,
      )

      // Connect via WebSocket and send reconnect
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`)
      const messages: Record<string, unknown>[] = []

      ws.on("message", data => {
        messages.push(JSON.parse(data.toString()))
      })

      await new Promise<void>(resolve => {
        ws.on("open", resolve)
      })

      // Wait for connected message
      await new Promise<void>(resolve => setTimeout(resolve, 50))

      // Clear initial messages
      messages.length = 0

      // Send reconnect request
      ws.send(JSON.stringify({ type: "reconnect", sessionId }))

      // Wait for pending_events response
      await new Promise<void>(resolve => setTimeout(resolve, 100))

      ws.close()

      // Should receive pending_events with all session events
      const pendingEventsMsg = messages.find(m => m.type === "pending_events")
      expect(pendingEventsMsg).toBeDefined()

      const events = pendingEventsMsg!.events as Record<string, unknown>[]
      // Should include session_created + 2 additional events we added
      expect(events.length).toBeGreaterThanOrEqual(2)
      expect(events.some(e => e.type === "user_message")).toBe(true)
      expect(events.some(e => e.type === "assistant_message")).toBe(true)
    })

    it("reconnect should return empty events if session not found (regression test)", async () => {
      // Create a session with app="ralph"
      const { sessionId } = await manager.createSession({ adapter: "stub", app: "ralph" })

      // Verify the session exists
      const info = manager.getSessionInfo(sessionId)
      expect(manager.getPersister().hasSession(sessionId, "ralph", info?.workspace)).toBe(true)

      // Connect via WebSocket and send reconnect WITHOUT app info
      // This simulates the bug: client only sends sessionId, not app
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`)
      const messages: Record<string, unknown>[] = []

      ws.on("message", data => {
        messages.push(JSON.parse(data.toString()))
      })

      await new Promise<void>(resolve => {
        ws.on("open", resolve)
      })

      // Wait for connected message
      await new Promise<void>(resolve => setTimeout(resolve, 50))

      // Clear initial messages
      messages.length = 0

      // Send reconnect request (without app - simulating the bug)
      ws.send(JSON.stringify({ type: "reconnect", sessionId }))

      // Wait for pending_events response
      await new Promise<void>(resolve => setTimeout(resolve, 100))

      ws.close()

      // This test verifies the fix: even without app in the reconnect message,
      // the server should look up the session's app and return the correct events
      const pendingEventsMsg = messages.find(m => m.type === "pending_events")
      expect(pendingEventsMsg).toBeDefined()

      const events = pendingEventsMsg!.events as Record<string, unknown>[]
      // Should include at least the session_created event
      expect(events.length).toBeGreaterThanOrEqual(1)
      expect(events.some(e => e.type === "session_created")).toBe(true)
    })
  })
})
