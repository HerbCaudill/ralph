import { describe, it, expect, vi, beforeEach } from "vitest"
import { registerTaskRoutes, type TaskRouteBeadsClient } from ".././taskRoutes"

/**
 * Lightweight mock Express app that records route registrations
 * and allows invoking handlers directly.
 */
function createMockApp() {
  const routes: Record<string, Map<string, Function>> = {
    get: new Map(),
    post: new Map(),
    patch: new Map(),
    delete: new Map(),
  }

  const app = {
    get: vi.fn((path: string, handler: Function) => {
      routes.get.set(path, handler)
    }),
    post: vi.fn((path: string, handler: Function) => {
      routes.post.set(path, handler)
    }),
    patch: vi.fn((path: string, handler: Function) => {
      routes.patch.set(path, handler)
    }),
    delete: vi.fn((path: string, handler: Function) => {
      routes.delete.set(path, handler)
    }),
  }

  return { app: app as any, routes }
}

/** Default workspace path for test requests. */
const TEST_WORKSPACE = "/test/workspace"

function createMockReqRes(
  overrides: { params?: Record<string, string>; query?: Record<string, string>; body?: any } = {},
) {
  const req = {
    params: overrides.params ?? {},
    query: { workspace: TEST_WORKSPACE, ...overrides.query },
    body: overrides.body ?? {},
  }

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }

  return { req, res }
}

function createMockBeadsClient(
  overrides: Partial<TaskRouteBeadsClient> = {},
): TaskRouteBeadsClient {
  return {
    listWithParents: vi.fn().mockResolvedValue([]),
    blocked: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "new-1", title: "New Task" }),
    show: vi.fn().mockResolvedValue([{ id: "task-1", title: "Task 1" }]),
    update: vi.fn().mockResolvedValue([{ id: "task-1", title: "Updated" }]),
    delete: vi.fn().mockResolvedValue(undefined),
    getLabels: vi.fn().mockResolvedValue(["bug", "feature"]),
    addLabel: vi.fn().mockResolvedValue({ label: "bug" }),
    removeLabel: vi.fn().mockResolvedValue({ label: "bug" }),
    addBlocker: vi.fn().mockResolvedValue({ blockerId: "blocker-1" }),
    removeBlocker: vi.fn().mockResolvedValue({ blockerId: "blocker-1" }),
    listAllLabels: vi.fn().mockResolvedValue(["bug", "feature", "docs"]),
    getComments: vi.fn().mockResolvedValue([{ id: "c1", text: "A comment" }]),
    addComment: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("registerTaskRoutes", () => {
  describe("route registration", () => {
    it("registers all expected GET routes", () => {
      const { app } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const getPaths = app.get.mock.calls.map((call: any[]) => call[0])
      expect(getPaths).toContain("/api/tasks")
      expect(getPaths).toContain("/api/tasks/blocked")
      expect(getPaths).toContain("/api/tasks/:id")
      expect(getPaths).toContain("/api/tasks/:id/labels")
      expect(getPaths).toContain("/api/labels")
      expect(getPaths).toContain("/api/tasks/:id/comments")
    })

    it("registers all expected POST routes", () => {
      const { app } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const postPaths = app.post.mock.calls.map((call: any[]) => call[0])
      expect(postPaths).toContain("/api/tasks")
      expect(postPaths).toContain("/api/tasks/:id/labels")
      expect(postPaths).toContain("/api/tasks/:id/blockers")
      expect(postPaths).toContain("/api/tasks/:id/comments")
    })

    it("registers all expected PATCH routes", () => {
      const { app } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const patchPaths = app.patch.mock.calls.map((call: any[]) => call[0])
      expect(patchPaths).toContain("/api/tasks/:id")
    })

    it("registers all expected DELETE routes", () => {
      const { app } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const deletePaths = app.delete.mock.calls.map((call: any[]) => call[0])
      expect(deletePaths).toContain("/api/tasks/:id")
      expect(deletePaths).toContain("/api/tasks/:id/labels/:label")
      expect(deletePaths).toContain("/api/tasks/:id/blockers/:blockerId")
    })

    it("registers exactly 14 routes total", () => {
      const { app } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const total =
        app.get.mock.calls.length +
        app.post.mock.calls.length +
        app.patch.mock.calls.length +
        app.delete.mock.calls.length

      expect(total).toBe(14)
    })
  })

  describe("GET /api/tasks handler", () => {
    it("returns tasks with 200 status", async () => {
      const beads = createMockBeadsClient({
        listWithParents: vi.fn().mockResolvedValue([{ id: "t1" }, { id: "t2" }]),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.get.get("/api/tasks")!
      const { req, res } = createMockReqRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        issues: [{ id: "t1" }, { id: "t2" }],
      })
    })

    it("passes query parameters to listWithParents", async () => {
      const beads = createMockBeadsClient()
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.get.get("/api/tasks")!
      const { req, res } = createMockReqRes({
        query: { status: "open", ready: "true", all: "false" },
      })

      await handler(req, res)

      expect(beads.listWithParents).toHaveBeenCalledWith({
        status: "open",
        ready: true,
        all: false,
        limit: 0,
      })
    })

    it("returns 500 on error", async () => {
      const beads = createMockBeadsClient({
        listWithParents: vi.fn().mockRejectedValue(new Error("DB connection failed")),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.get.get("/api/tasks")!
      const { req, res } = createMockReqRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "DB connection failed" })
    })
  })

  describe("POST /api/tasks handler", () => {
    it("creates a task and returns 201", async () => {
      const beads = createMockBeadsClient({
        create: vi.fn().mockResolvedValue({ id: "new-1", title: "My Task" }),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.post.get("/api/tasks")!
      const { req, res } = createMockReqRes({ body: { title: "My Task" } })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        issue: { id: "new-1", title: "My Task" },
      })
    })

    it("returns 400 when title is missing", async () => {
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const handler = routes.post.get("/api/tasks")!
      const { req, res } = createMockReqRes({ body: {} })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Title is required" })
    })

    it("returns 400 when title is whitespace only", async () => {
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const handler = routes.post.get("/api/tasks")!
      const { req, res } = createMockReqRes({ body: { title: "   " } })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it("returns 500 when create returns null", async () => {
      const beads = createMockBeadsClient({
        create: vi.fn().mockResolvedValue(null),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.post.get("/api/tasks")!
      const { req, res } = createMockReqRes({ body: { title: "Task" } })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: "Failed to create task - no issue returned",
      })
    })

    it("trims the title before creating", async () => {
      const beads = createMockBeadsClient()
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.post.get("/api/tasks")!
      const { req, res } = createMockReqRes({ body: { title: "  My Task  " } })

      await handler(req, res)

      expect(beads.create).toHaveBeenCalledWith(expect.objectContaining({ title: "My Task" }))
    })
  })

  describe("GET /api/tasks/:id handler", () => {
    it("returns the task with 200 status", async () => {
      const beads = createMockBeadsClient({
        show: vi.fn().mockResolvedValue([{ id: "task-1", title: "Task 1" }]),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.get.get("/api/tasks/:id")!
      const { req, res } = createMockReqRes({ params: { id: "task-1" } })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        issue: { id: "task-1", title: "Task 1" },
      })
    })

    it("returns 404 when task is not found", async () => {
      const beads = createMockBeadsClient({
        show: vi.fn().mockResolvedValue([]),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.get.get("/api/tasks/:id")!
      const { req, res } = createMockReqRes({ params: { id: "missing" } })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Task not found" })
    })
  })

  describe("PATCH /api/tasks/:id handler", () => {
    it("updates and returns the task", async () => {
      const beads = createMockBeadsClient({
        update: vi.fn().mockResolvedValue([{ id: "task-1", title: "Updated", status: "closed" }]),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.patch.get("/api/tasks/:id")!
      const { req, res } = createMockReqRes({
        params: { id: "task-1" },
        body: { title: "Updated", status: "closed" },
      })

      await handler(req, res)

      expect(beads.update).toHaveBeenCalledWith("task-1", {
        title: "Updated",
        description: undefined,
        priority: undefined,
        status: "closed",
        type: undefined,
        assignee: undefined,
        parent: undefined,
      })
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it("claims a task by setting status and assignee together", async () => {
      const beads = createMockBeadsClient({
        update: vi
          .fn()
          .mockResolvedValue([{ id: "task-1", status: "in_progress", assignee: "homer" }]),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.patch.get("/api/tasks/:id")!
      const { req, res } = createMockReqRes({
        params: { id: "task-1" },
        body: { status: "in_progress", assignee: "homer" },
      })

      await handler(req, res)

      expect(beads.update).toHaveBeenCalledWith("task-1", {
        title: undefined,
        description: undefined,
        priority: undefined,
        status: "in_progress",
        type: undefined,
        assignee: "homer",
        parent: undefined,
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        issue: { id: "task-1", status: "in_progress", assignee: "homer" },
      })
    })

    it("returns 404 when update returns empty array", async () => {
      const beads = createMockBeadsClient({
        update: vi.fn().mockResolvedValue([]),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.patch.get("/api/tasks/:id")!
      const { req, res } = createMockReqRes({
        params: { id: "missing" },
        body: { title: "Updated" },
      })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })
  })

  describe("DELETE /api/tasks/:id handler", () => {
    it("deletes a task and returns 200", async () => {
      const beads = createMockBeadsClient()
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.delete.get("/api/tasks/:id")!
      const { req, res } = createMockReqRes({ params: { id: "task-1" } })

      await handler(req, res)

      expect(beads.delete).toHaveBeenCalledWith("task-1")
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ ok: true })
    })
  })

  describe("POST /api/tasks/:id/labels handler", () => {
    it("returns 400 when label is missing", async () => {
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const handler = routes.post.get("/api/tasks/:id/labels")!
      const { req, res } = createMockReqRes({ params: { id: "task-1" }, body: {} })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Label is required" })
    })

    it("adds a label and returns 201", async () => {
      const beads = createMockBeadsClient()
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.post.get("/api/tasks/:id/labels")!
      const { req, res } = createMockReqRes({
        params: { id: "task-1" },
        body: { label: "bug" },
      })

      await handler(req, res)

      expect(beads.addLabel).toHaveBeenCalledWith("task-1", "bug")
      expect(res.status).toHaveBeenCalledWith(201)
    })
  })

  describe("POST /api/tasks/:id/blockers handler", () => {
    it("returns 400 when blockerId is missing", async () => {
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const handler = routes.post.get("/api/tasks/:id/blockers")!
      const { req, res } = createMockReqRes({ params: { id: "task-1" }, body: {} })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Blocker ID is required" })
    })

    it("adds a blocker and returns 201", async () => {
      const beads = createMockBeadsClient()
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.post.get("/api/tasks/:id/blockers")!
      const { req, res } = createMockReqRes({
        params: { id: "task-1" },
        body: { blockerId: "blocker-1" },
      })

      await handler(req, res)

      expect(beads.addBlocker).toHaveBeenCalledWith("task-1", "blocker-1")
      expect(res.status).toHaveBeenCalledWith(201)
    })
  })

  describe("POST /api/tasks/:id/comments handler", () => {
    it("returns 400 when comment is missing", async () => {
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const handler = routes.post.get("/api/tasks/:id/comments")!
      const { req, res } = createMockReqRes({ params: { id: "task-1" }, body: {} })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Comment is required" })
    })

    it("adds a comment and returns 201", async () => {
      const beads = createMockBeadsClient()
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.post.get("/api/tasks/:id/comments")!
      const { req, res } = createMockReqRes({
        params: { id: "task-1" },
        body: { comment: "Great progress!", author: "alice" },
      })

      await handler(req, res)

      expect(beads.addComment).toHaveBeenCalledWith("task-1", "Great progress!", "alice")
      expect(res.status).toHaveBeenCalledWith(201)
    })
  })

  describe("workspace query parameter", () => {
    it("returns 400 when workspace query parameter is missing", async () => {
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => createMockBeadsClient() })

      const handler = routes.get.get("/api/tasks")!
      const req = { params: {}, query: {}, body: {} }
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: "workspace query parameter is required",
      })
    })

    it("passes workspace to getBeadsClient", async () => {
      const beads = createMockBeadsClient()
      const getBeadsClient = vi.fn().mockReturnValue(beads)
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient })

      const handler = routes.get.get("/api/tasks")!
      const { req, res } = createMockReqRes()

      await handler(req, res)

      expect(getBeadsClient).toHaveBeenCalledWith(TEST_WORKSPACE)
    })
  })

  describe("error handling", () => {
    it("returns generic error message for non-Error exceptions", async () => {
      const beads = createMockBeadsClient({
        listWithParents: vi.fn().mockRejectedValue("string error"),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.get.get("/api/tasks")!
      const { req, res } = createMockReqRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ ok: false, error: "Failed to list tasks" })
    })

    it("returns 404 for WorkspaceNotFoundError", async () => {
      // Create a mock error with name = "WorkspaceNotFoundError"
      const error = new Error("workspace not found: herbcaudill/ralph")
      error.name = "WorkspaceNotFoundError"

      const { app, routes } = createMockApp()
      registerTaskRoutes({
        app,
        getBeadsClient: () => {
          throw error
        },
      })

      const handler = routes.get.get("/api/tasks")!
      const { req, res } = createMockReqRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: "workspace not found: herbcaudill/ralph",
      })
    })

    it("returns 404 when bd show throws 'no issue found' error", async () => {
      const beads = createMockBeadsClient({
        show: vi
          .fn()
          .mockRejectedValue(
            new Error(
              'bd exited with code 1: {"error": "resolving ID w-0kt: operation failed: failed to resolve ID: no issue found matching \\"w-0kt\\""}',
            ),
          ),
      })
      const { app, routes } = createMockApp()
      registerTaskRoutes({ app, getBeadsClient: () => beads })

      const handler = routes.get.get("/api/tasks/:id")!
      const { req, res } = createMockReqRes({ params: { id: "w-0kt" } })

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it("returns 500 for other errors", async () => {
      const { app, routes } = createMockApp()
      registerTaskRoutes({
        app,
        getBeadsClient: () => {
          throw new Error("Database connection failed")
        },
      })

      const handler = routes.get.get("/api/tasks")!
      const { req, res } = createMockReqRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: "Database connection failed",
      })
    })
  })
})
