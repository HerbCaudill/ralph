import { describe, it, expect, vi, beforeEach } from "vitest"
import express from "express"
import { registerAgentControlRoutes } from ".././agentControlRoutes.js"
import type { AgentRouteContext } from ".././types.js"

function createMockManager(overrides = {}) {
  return {
    isRunning: false,
    status: "stopped" as const,
    canAcceptMessages: false,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    stopAfterCurrent: vi.fn(),
    cancelStopAfterCurrent: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    ...overrides,
  }
}

function createMockContext(managerOverrides = {}): AgentRouteContext {
  const manager = createMockManager(managerOverrides)
  return {
    getRalphRegistry: vi.fn(),
    getWorkspacePath: vi.fn().mockReturnValue("/tmp/test"),
    logRalphEvents: false,
    isDevMode: vi.fn().mockReturnValue(false),
    getRalphManager: vi.fn().mockReturnValue(manager),
    getTaskChatManager: vi.fn(),
    getTaskChatEventPersister: vi.fn(),
    getEventHistory: vi.fn().mockReturnValue([]),
    setEventHistory: vi.fn(),
  }
}

function createApp(ctx: AgentRouteContext) {
  const app = express()
  app.use(express.json())
  registerAgentControlRoutes(app, ctx)
  return app
}

async function fetchJson(app: ReturnType<typeof express>, path: string, options: RequestInit = {}) {
  const { createServer } = await import("node:http")
  const server = createServer(app)
  const port = await new Promise<number>(resolve => {
    server.listen(0, "localhost", () => {
      const addr = server.address()
      resolve(typeof addr === "object" && addr ? addr.port : 0)
    })
  })

  try {
    const res = await fetch(`http://localhost:${port}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    })
    const body = await res.json()
    return { status: res.status, body }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

describe("agentControlRoutes", () => {
  describe("POST /api/start", () => {
    it("starts ralph when not running", async () => {
      const ctx = createMockContext()
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/start", { method: "POST" })

      expect(status).toBe(200)
      expect(body.ok).toBe(true)
    })

    it("returns 409 when already running", async () => {
      const ctx = createMockContext({ isRunning: true, status: "running" })
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/start", { method: "POST" })

      expect(status).toBe(409)
      expect(body.ok).toBe(false)
      expect(body.error).toMatch(/already running/)
    })

    it("passes sessions count from request body", async () => {
      const ctx = createMockContext()
      const app = createApp(ctx)
      const manager = ctx.getRalphManager()

      await fetchJson(app, "/api/start", {
        method: "POST",
        body: JSON.stringify({ sessions: 5 }),
      })

      expect(manager.start).toHaveBeenCalledWith(5)
    })
  })

  describe("POST /api/stop", () => {
    it("stops ralph when running", async () => {
      const ctx = createMockContext({ isRunning: true, status: "running" })
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/stop", { method: "POST" })

      expect(status).toBe(200)
      expect(body.ok).toBe(true)
    })

    it("returns 409 when not running", async () => {
      const ctx = createMockContext({ isRunning: false, status: "stopped" })
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/stop", { method: "POST" })

      expect(status).toBe(409)
      expect(body.ok).toBe(false)
    })
  })

  describe("POST /api/pause", () => {
    it("pauses ralph", async () => {
      const ctx = createMockContext()
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/pause", { method: "POST" })

      expect(status).toBe(200)
      expect(body.ok).toBe(true)
    })
  })

  describe("POST /api/resume", () => {
    it("resumes ralph", async () => {
      const ctx = createMockContext()
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/resume", { method: "POST" })

      expect(status).toBe(200)
      expect(body.ok).toBe(true)
    })
  })

  describe("POST /api/message", () => {
    it("sends a string message", async () => {
      const ctx = createMockContext({ canAcceptMessages: true, isRunning: true })
      const app = createApp(ctx)
      const manager = ctx.getRalphManager()

      const { status, body } = await fetchJson(app, "/api/message", {
        method: "POST",
        body: JSON.stringify({ message: "hello" }),
      })

      expect(status).toBe(200)
      expect(body.ok).toBe(true)
      expect(manager.send).toHaveBeenCalledWith({ type: "message", text: "hello" })
    })

    it("sends an object message directly", async () => {
      const ctx = createMockContext({ canAcceptMessages: true, isRunning: true })
      const app = createApp(ctx)
      const manager = ctx.getRalphManager()

      const payload = { type: "custom", data: "test" }
      await fetchJson(app, "/api/message", {
        method: "POST",
        body: JSON.stringify({ message: payload }),
      })

      expect(manager.send).toHaveBeenCalledWith(payload)
    })

    it("returns 409 when not accepting messages", async () => {
      const ctx = createMockContext({ canAcceptMessages: false })
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/message", {
        method: "POST",
        body: JSON.stringify({ message: "hello" }),
      })

      expect(status).toBe(409)
      expect(body.ok).toBe(false)
    })

    it("returns 400 when message is missing", async () => {
      const ctx = createMockContext({ canAcceptMessages: true })
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/message", {
        method: "POST",
        body: JSON.stringify({}),
      })

      expect(status).toBe(400)
      expect(body.error).toMatch(/required/)
    })
  })

  describe("GET /api/status", () => {
    it("returns current status", async () => {
      const ctx = createMockContext({ status: "running" })
      const app = createApp(ctx)

      const { status, body } = await fetchJson(app, "/api/status")

      expect(status).toBe(200)
      expect(body).toEqual({ ok: true, status: "running" })
    })
  })
})
