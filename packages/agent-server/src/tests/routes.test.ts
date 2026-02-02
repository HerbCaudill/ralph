import { describe, it, expect, vi } from "vitest"
import express from "express"
import { registerRoutes, type RouteContext } from ".././routes.js"
import type { ChatSessionManager } from ".././ChatSessionManager.js"
import type { SessionPersister } from ".././SessionPersister.js"

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
  // Use a random available port
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

describe("routes", () => {
  describe("GET /api/sessions/latest", () => {
    it("resolves to the latest session route, not the :id route", async () => {
      const ctx = createMockContext()
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions/latest")

      expect(res.status).toBe(200)
      // The response should contain the session info for the latest session,
      // not a 404 from the /:id handler trying to look up a session called "latest"
      expect(res.body.sessionId).toBe("latest-session-abc")
    })

    it("returns 404 when no sessions exist", async () => {
      const ctx = createMockContext({
        persister: { getLatestSessionId: vi.fn().mockReturnValue(null) },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions/latest")

      expect(res.status).toBe(404)
      expect(res.body.error).toBe("No sessions found")
    })
  })

  describe("GET /api/sessions/:id", () => {
    it("returns session info for a specific session ID", async () => {
      const app = createTestApp()

      const res = await request(app, "GET", "/api/sessions/abc123")

      expect(res.status).toBe(200)
      expect(res.body.sessionId).toBe("abc123")
    })

    it("returns 404 for an unknown session ID", async () => {
      const ctx = createMockContext({
        sessionManager: { getSessionInfo: vi.fn().mockReturnValue(null) },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions/unknown-id")

      expect(res.status).toBe(404)
      expect(res.body.error).toBe("Session not found")
    })
  })

  describe("route ordering: /latest before /:id", () => {
    it("does not treat 'latest' as a session ID parameter", async () => {
      const getSessionInfo = vi.fn().mockReturnValue(null)
      const ctx = createMockContext({
        sessionManager: { getSessionInfo },
      })
      const app = createTestApp(ctx)

      await request(app, "GET", "/api/sessions/latest")

      // getSessionInfo should be called with the resolved latest session ID,
      // NOT with the literal string "latest"
      expect(getSessionInfo).not.toHaveBeenCalledWith("latest")
    })
  })

  describe("GET /healthz", () => {
    it("returns ok", async () => {
      const app = createTestApp()

      const res = await request(app, "GET", "/healthz")

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true, server: "agent-server" })
    })
  })
})
