import type { Request, Response, Express } from "express"

/**
 * Interface for the beads proxy that task routes depend on.
 * This mirrors the BeadsClient API surface used by the routes.
 */
export interface TaskRouteBdProxy {
  listWithParents(options: {
    status?: "open" | "in_progress" | "blocked" | "deferred" | "closed"
    ready?: boolean
    all?: boolean
    limit?: number
  }): Promise<unknown[]>
  blocked(parent?: string): Promise<unknown[]>
  create(options: {
    title: string
    description?: string
    priority?: number
    type?: string
    assignee?: string
    parent?: string
    labels?: string[]
  }): Promise<unknown | null>
  show(id: string): Promise<unknown[]>
  update(
    id: string,
    options: {
      title?: string
      description?: string
      priority?: number
      status?: "open" | "in_progress" | "blocked" | "deferred" | "closed"
      type?: string
      assignee?: string
      parent?: string
    },
  ): Promise<unknown[]>
  delete(id: string): Promise<void>
  getLabels(id: string): Promise<unknown[]>
  addLabel(id: string, label: string): Promise<unknown>
  removeLabel(id: string, label: string): Promise<unknown>
  addBlocker(id: string, blockerId: string): Promise<unknown>
  removeBlocker(id: string, blockerId: string): Promise<unknown>
  listAllLabels(): Promise<unknown[]>
  getComments(id: string): Promise<unknown[]>
  addComment(id: string, comment: string, author?: string): Promise<void>
}

/**
 * Options for registering task routes.
 */
export interface TaskRoutesOptions {
  /** Express app to register routes on. */
  app: Express
  /** Accessor function to get a BdProxy for the given workspace path. */
  getBdProxy: (workspacePath: string) => TaskRouteBdProxy
}

/**
 * Register all task management API routes on an Express app.
 *
 * Routes registered:
 * - GET    /api/tasks
 * - GET    /api/tasks/blocked
 * - POST   /api/tasks
 * - GET    /api/tasks/:id
 * - PATCH  /api/tasks/:id
 * - DELETE /api/tasks/:id
 * - GET    /api/tasks/:id/labels
 * - POST   /api/tasks/:id/labels
 * - DELETE /api/tasks/:id/labels/:label
 * - POST   /api/tasks/:id/blockers
 * - DELETE /api/tasks/:id/blockers/:blockerId
 * - GET    /api/labels
 * - GET    /api/tasks/:id/comments
 * - POST   /api/tasks/:id/comments
 */
export function registerTaskRoutes({ app, getBdProxy }: TaskRoutesOptions): void {
  /**
   * Extract the workspace query parameter from a request.
   * Returns the workspace path or sends a 400 error if missing.
   */
  function extractWorkspace(req: Request, res: Response): string | null {
    const workspace = req.query.workspace as string | undefined
    if (!workspace?.trim()) {
      res.status(400).json({ ok: false, error: "workspace query parameter is required" })
      return null
    }
    return workspace.trim()
  }

  // List tasks
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const { status, ready, all } = req.query as {
        status?: string
        ready?: string
        all?: string
      }

      const bdProxy = getBdProxy(workspace)
      const issues = await bdProxy.listWithParents({
        status: status as "open" | "in_progress" | "blocked" | "deferred" | "closed" | undefined,
        ready: ready === "true",
        all: all === "true",
        limit: 0,
      })

      res.status(200).json({ ok: true, issues })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list tasks"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get blocked tasks
  app.get("/api/tasks/blocked", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const { parent } = req.query as { parent?: string }

      const bdProxy = getBdProxy(workspace)
      const issues = await bdProxy.blocked(parent)

      res.status(200).json({ ok: true, issues })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list blocked tasks"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Create task
  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const { title, description, priority, type, assignee, parent, labels } = req.body as {
        title?: string
        description?: string
        priority?: number
        type?: string
        assignee?: string
        parent?: string
        labels?: string[]
      }

      if (!title?.trim()) {
        res.status(400).json({ ok: false, error: "Title is required" })
        return
      }

      const bdProxy = getBdProxy(workspace)
      const options: {
        title: string
        description?: string
        priority?: number
        type?: string
        assignee?: string
        parent?: string
        labels?: string[]
      } = { title: title.trim() }
      if (description) options.description = description
      if (priority !== undefined) options.priority = priority
      if (type) options.type = type
      if (assignee) options.assignee = assignee
      if (parent) options.parent = parent
      if (labels) options.labels = labels

      const issue = await bdProxy.create(options)

      if (!issue) {
        res.status(500).json({ ok: false, error: "Failed to create task - no issue returned" })
        return
      }

      res.status(201).json({ ok: true, issue })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get single task
  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const bdProxy = getBdProxy(workspace)
      const issues = await bdProxy.show(id)

      if (issues.length === 0) {
        res.status(404).json({ ok: false, error: "Task not found" })
        return
      }

      res.status(200).json({ ok: true, issue: issues[0] })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Update task
  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string
      const { title, description, priority, status, type, assignee, parent } = req.body as {
        title?: string
        description?: string
        priority?: number
        status?: "open" | "in_progress" | "blocked" | "deferred" | "closed"
        type?: string
        assignee?: string
        parent?: string
      }

      const bdProxy = getBdProxy(workspace)
      const issues = await bdProxy.update(id, {
        title,
        description,
        priority,
        status,
        type,
        assignee,
        parent,
      })

      if (issues.length === 0) {
        res.status(404).json({ ok: false, error: "Task not found" })
        return
      }

      res.status(200).json({ ok: true, issue: issues[0] })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Delete task
  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const bdProxy = getBdProxy(workspace)
      await bdProxy.delete(id)

      res.status(200).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get labels for a task
  app.get("/api/tasks/:id/labels", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const bdProxy = getBdProxy(workspace)
      const labels = await bdProxy.getLabels(id)

      res.status(200).json({ ok: true, labels })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get labels"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Add label to a task
  app.post("/api/tasks/:id/labels", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string
      const { label } = req.body as { label?: string }

      if (!label?.trim()) {
        res.status(400).json({ ok: false, error: "Label is required" })
        return
      }

      const bdProxy = getBdProxy(workspace)
      const result = await bdProxy.addLabel(id, label.trim())

      res.status(201).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add label"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Remove label from a task
  app.delete("/api/tasks/:id/labels/:label", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string
      const label = req.params.label as string

      if (!label?.trim()) {
        res.status(400).json({ ok: false, error: "Label is required" })
        return
      }

      const bdProxy = getBdProxy(workspace)
      const result = await bdProxy.removeLabel(id, label.trim())

      res.status(200).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove label"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Add blocker to a task
  app.post("/api/tasks/:id/blockers", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string
      const { blockerId } = req.body as { blockerId?: string }

      if (!blockerId?.trim()) {
        res.status(400).json({ ok: false, error: "Blocker ID is required" })
        return
      }

      const bdProxy = getBdProxy(workspace)
      const result = await bdProxy.addBlocker(id, blockerId.trim())

      res.status(201).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add blocker"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Remove blocker from a task
  app.delete("/api/tasks/:id/blockers/:blockerId", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string
      const blockerId = req.params.blockerId as string

      if (!blockerId?.trim()) {
        res.status(400).json({ ok: false, error: "Blocker ID is required" })
        return
      }

      const bdProxy = getBdProxy(workspace)
      const result = await bdProxy.removeBlocker(id, blockerId.trim())

      res.status(200).json({ ok: true, result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove blocker"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // List all unique labels
  app.get("/api/labels", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const bdProxy = getBdProxy(workspace)
      const labels = await bdProxy.listAllLabels()

      res.status(200).json({ ok: true, labels })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list labels"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Get comments for a task
  app.get("/api/tasks/:id/comments", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const bdProxy = getBdProxy(workspace)
      const comments = await bdProxy.getComments(id)

      res.status(200).json({ ok: true, comments })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get comments"
      res.status(500).json({ ok: false, error: message })
    }
  })

  // Add comment to a task
  app.post("/api/tasks/:id/comments", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string
      const { comment, author } = req.body as { comment?: string; author?: string }

      if (!comment?.trim()) {
        res.status(400).json({ ok: false, error: "Comment is required" })
        return
      }

      const bdProxy = getBdProxy(workspace)
      await bdProxy.addComment(id, comment.trim(), author)

      res.status(201).json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add comment"
      res.status(500).json({ ok: false, error: message })
    }
  })
}
