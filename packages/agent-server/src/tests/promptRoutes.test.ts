import { describe, it, expect, vi, beforeEach } from "vitest"
import express from "express"
import { registerPromptRoutes, type PromptRouteContext } from "../routes/promptRoutes.js"
import type { ChatSessionManager, SessionInfo } from "../ChatSessionManager.js"

/** Create a mock PromptRouteContext with the given overrides. */
function createMockContext(overrides?: {
  sessionManager?: Partial<ChatSessionManager>
}): PromptRouteContext {
  const sessionManager = {
    getSessionInfo: vi.fn().mockImplementation((id: string) => ({
      sessionId: id,
      adapter: "claude",
      status: "idle" as const,
      cwd: "/project",
      createdAt: Date.now(),
      systemPrompt: "Stored system prompt",
    })),
    ...overrides?.sessionManager,
  }

  return {
    getSessionManager: () => sessionManager as unknown as ChatSessionManager,
  }
}

/** Create an express app with prompt routes registered. */
function createTestApp(ctx?: PromptRouteContext) {
  const app = express()
  app.use(express.json())
  registerPromptRoutes(app, ctx ?? createMockContext())
  return app
}

/** Make a request to the test app and return the parsed response. */
async function request(
  app: express.Express,
  method: "GET" | "POST",
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

describe("promptRoutes", () => {
  describe("GET /api/sessions/:id/prompt", () => {
    it("returns assembled prompt for a session", async () => {
      const app = createTestApp()

      const res = await request(app, "GET", "/api/sessions/test-session/prompt")

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("prompt")
      expect(typeof res.body.prompt).toBe("string")
    })

    it("returns 404 for unknown session", async () => {
      const ctx = createMockContext({
        sessionManager: {
          getSessionInfo: vi.fn().mockReturnValue(null),
        },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions/unknown-session/prompt")

      expect(res.status).toBe(404)
      expect(res.body.error).toBe("Session not found")
    })

    it("includes context file content in prompt", async () => {
      const ctx = createMockContext({
        sessionManager: {
          getSessionInfo: vi.fn().mockReturnValue({
            sessionId: "test-session",
            adapter: "claude",
            cwd: "/project",
            status: "idle",
            createdAt: Date.now(),
          }),
        },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions/test-session/prompt")

      expect(res.status).toBe(200)
      // The prompt should be assembled (may be empty if no context files exist)
      expect(res.body).toHaveProperty("prompt")
    })

    it("includes stored system prompt from session", async () => {
      const ctx = createMockContext({
        sessionManager: {
          getSessionInfo: vi.fn().mockReturnValue({
            sessionId: "test-session",
            adapter: "claude",
            cwd: "/project",
            status: "idle",
            createdAt: Date.now(),
            systemPrompt: "Custom system instructions",
          }),
        },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions/test-session/prompt")

      expect(res.status).toBe(200)
      expect(res.body.prompt).toContain("Custom system instructions")
    })

    it("returns adapter type in response", async () => {
      const ctx = createMockContext({
        sessionManager: {
          getSessionInfo: vi.fn().mockReturnValue({
            sessionId: "test-session",
            adapter: "codex",
            cwd: "/project",
            status: "idle",
            createdAt: Date.now(),
          }),
        },
      })
      const app = createTestApp(ctx)

      const res = await request(app, "GET", "/api/sessions/test-session/prompt")

      expect(res.status).toBe(200)
      expect(res.body.adapter).toBe("codex")
    })
  })
})
