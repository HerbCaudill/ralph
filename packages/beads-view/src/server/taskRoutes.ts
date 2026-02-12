import type { Request, Response, Express } from "express"

/**
 * Check if an error is a WorkspaceNotFoundError.
 * Works by checking the error name to avoid circular dependencies with beads-server.
 */
function isWorkspaceNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.name === "WorkspaceNotFoundError"
}

/** Check if an error indicates that an issue was not found by `bd`. */
function isIssueNotFoundError(err: unknown): boolean {
  return err instanceof Error && /no issue found/i.test(err.message)
}

/**
 * Send an appropriate error response based on the error type.
 */
function sendErrorResponse(res: Response, err: unknown, defaultMessage: string): void {
  if (isWorkspaceNotFoundError(err) || isIssueNotFoundError(err)) {
    const message = err instanceof Error ? err.message : "Not found"
    res.status(404).json({ ok: false, error: message })
  } else {
    const message = err instanceof Error ? err.message : defaultMessage
    res.status(500).json({ ok: false, error: message })
  }
}

/**
 * Interface for the beads proxy that task routes depend on.
 * This mirrors the BeadsClient API surface used by the routes.
 */
export interface TaskRouteBeadsClient {
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
  /** Accessor function to get a BeadsClient for the given workspace path. */
  getBeadsClient: (workspacePath: string) => TaskRouteBeadsClient
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
export function registerTaskRoutes({ app, getBeadsClient }: TaskRoutesOptions): void {
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

      const beads = getBeadsClient(workspace)
      const issues = await beads.listWithParents({
        status: status as "open" | "in_progress" | "blocked" | "deferred" | "closed" | undefined,
        ready: ready === "true",
        all: all === "true",
        limit: 0,
      })

      res.status(200).json({ ok: true, issues })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to list tasks")
    }
  })

  // Get blocked tasks
  app.get("/api/tasks/blocked", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const { parent } = req.query as { parent?: string }

      const beads = getBeadsClient(workspace)
      const issues = await beads.blocked(parent)

      res.status(200).json({ ok: true, issues })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to list blocked tasks")
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

      const beads = getBeadsClient(workspace)
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

      const issue = await beads.create(options)

      if (!issue) {
        res.status(500).json({ ok: false, error: "Failed to create task - no issue returned" })
        return
      }

      res.status(201).json({ ok: true, issue })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to create task")
    }
  })

  // Get single task
  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const beads = getBeadsClient(workspace)
      const issues = await beads.show(id)

      if (issues.length === 0) {
        res.status(404).json({ ok: false, error: "Task not found" })
        return
      }

      res.status(200).json({ ok: true, issue: issues[0] })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to get task")
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

      const beads = getBeadsClient(workspace)
      const issues = await beads.update(id, {
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
      sendErrorResponse(res, err, "Failed to update task")
    }
  })

  // Delete task
  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const beads = getBeadsClient(workspace)
      await beads.delete(id)

      res.status(200).json({ ok: true })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to delete task")
    }
  })

  // Get labels for a task
  app.get("/api/tasks/:id/labels", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const beads = getBeadsClient(workspace)
      const labels = await beads.getLabels(id)

      res.status(200).json({ ok: true, labels })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to get labels")
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

      const beads = getBeadsClient(workspace)
      const result = await beads.addLabel(id, label.trim())

      res.status(201).json({ ok: true, result })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to add label")
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

      const beads = getBeadsClient(workspace)
      const result = await beads.removeLabel(id, label.trim())

      res.status(200).json({ ok: true, result })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to remove label")
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

      const beads = getBeadsClient(workspace)
      const result = await beads.addBlocker(id, blockerId.trim())

      res.status(201).json({ ok: true, result })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to add blocker")
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

      const beads = getBeadsClient(workspace)
      const result = await beads.removeBlocker(id, blockerId.trim())

      res.status(200).json({ ok: true, result })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to remove blocker")
    }
  })

  // List all unique labels
  app.get("/api/labels", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const beads = getBeadsClient(workspace)
      const labels = await beads.listAllLabels()

      res.status(200).json({ ok: true, labels })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to list labels")
    }
  })

  // Get comments for a task
  app.get("/api/tasks/:id/comments", async (req: Request, res: Response) => {
    try {
      const workspace = extractWorkspace(req, res)
      if (!workspace) return

      const id = req.params.id as string

      const beads = getBeadsClient(workspace)
      const comments = await beads.getComments(id)

      res.status(200).json({ ok: true, comments })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to get comments")
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

      const beads = getBeadsClient(workspace)
      await beads.addComment(id, comment.trim(), author)

      res.status(201).json({ ok: true })
    } catch (err) {
      sendErrorResponse(res, err, "Failed to add comment")
    }
  })
}
