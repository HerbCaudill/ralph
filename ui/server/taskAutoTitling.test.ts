import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { createServer, type Server } from "node:http"
import express, { type Express, type Request, type Response } from "express"
import type { BdProxy, BdCreateOptions } from "./BdProxy.js"
import { TaskTitlingService, type TitlingResult } from "./TaskTitlingService.js"
import type { Issue } from "./BdProxy.js"

// Mock the TaskTitlingService
const mockParseTask = vi.fn()
const mockOn = vi.fn()
const mockRemoveAllListeners = vi.fn()

vi.mock("./TaskTitlingService.js", () => ({
  TaskTitlingService: class MockTaskTitlingService {
    parseTask = mockParseTask
    on = mockOn
    removeAllListeners = mockRemoveAllListeners
  },
}))

// Mock broadcast function
let broadcastCalls: unknown[] = []
function broadcast(message: unknown): void {
  broadcastCalls.push(message)
}

// Mock BdProxy
class MockBdProxy {
  async create(options: BdCreateOptions): Promise<Issue> {
    return {
      id: "test-123",
      title: options.title,
      description: options.description ?? "",
      status: "open",
      priority: options.priority ?? 2,
      type: options.type ?? "task",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as Issue
  }

  async update(id: string, options: Partial<Issue>): Promise<Issue[]> {
    return [
      {
        id,
        title: options.title ?? "Updated title",
        description: options.description ?? "Updated description",
        status: options.status ?? "open",
        priority: options.priority ?? 2,
        type: options.type ?? "task",
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      } as Issue,
    ]
  }
}

// Test app setup
function createTestApp(
  getBdProxy: () => BdProxy,
  getTaskTitlingService: () => TaskTitlingService,
): Express {
  const app = express()
  app.use(express.json())

  // Simplified POST /api/tasks endpoint with auto-titling
  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
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

      const bdProxy = getBdProxy()
      const options: BdCreateOptions = { title: title.trim() }
      if (description) options.description = description
      if (priority !== undefined) options.priority = priority
      if (type) options.type = type
      if (assignee) options.assignee = assignee
      if (parent) options.parent = parent
      if (labels) options.labels = labels

      const issue = await bdProxy.create(options)

      // Only auto-title if this was created via quick input (title-only, no description)
      // and the title is long enough to potentially benefit from parsing
      const isQuickInput = !description && !priority && !type && !assignee && !parent && !labels
      if (isQuickInput && title.trim().length > 0) {
        // Fire and forget - don't block the response
        autoTitleTask(issue.id, title.trim(), getTaskTitlingService, getBdProxy, broadcast).catch(
          err => {
            console.error("[task-titling] Error auto-titling task:", err)
          },
        )
      }

      res.status(201).json({ ok: true, issue })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create task"
      res.status(500).json({ ok: false, error: message })
    }
  })

  return app
}

// Auto-titling function (extracted from server/index.ts for testing)
async function autoTitleTask(
  taskId: string,
  taskText: string,
  getTaskTitlingService: () => TaskTitlingService,
  getBdProxy: () => BdProxy,
  broadcast: (message: unknown) => void,
): Promise<void> {
  try {
    const titlingService = getTaskTitlingService()
    const result = await titlingService.parseTask(taskText)

    // Only update if the title or description changed
    const titleChanged = result.title !== taskText
    const hasDescription = result.description.length > 0

    if (!titleChanged && !hasDescription) {
      // No changes needed
      return
    }

    // Update the task with refined title and description
    const bdProxy = getBdProxy()
    const updateOptions: { title?: string; description?: string } = {}

    if (titleChanged) {
      updateOptions.title = result.title
    }
    if (hasDescription) {
      updateOptions.description = result.description
    }

    const updatedIssues = await bdProxy.update(taskId, updateOptions)

    if (updatedIssues.length > 0) {
      // Broadcast the update via WebSocket so the UI updates in real-time
      broadcast({
        type: "task:updated",
        issue: updatedIssues[0],
        timestamp: Date.now(),
      })
    }
  } catch (err) {
    // Log but don't throw - this is a background operation
    console.error(`[task-titling] Failed to auto-title task ${taskId}:`, err)
  }
}

// Tests
describe("Task Auto-Titling Integration", () => {
  let server: Server
  let mockBdProxy: MockBdProxy
  let mockTitlingService: TaskTitlingService
  const port = 3099

  beforeAll(async () => {
    mockBdProxy = new MockBdProxy()
    mockTitlingService = new TaskTitlingService()

    const app = createTestApp(
      () => mockBdProxy as unknown as BdProxy,
      () => mockTitlingService,
    )
    server = createServer(app)

    await new Promise<void>(resolve => {
      server.listen(port, "localhost", () => resolve())
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server close timeout"))
      }, 5000)
      server.close(err => {
        clearTimeout(timeout)
        if (err) reject(err)
        else resolve()
      })
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockParseTask.mockClear()
    mockOn.mockClear()
    mockRemoveAllListeners.mockClear()
    broadcastCalls = []
  })

  afterEach(() => {
    vi.clearAllMocks()
    mockParseTask.mockClear()
    mockOn.mockClear()
    mockRemoveAllListeners.mockClear()
  })

  describe("POST /api/tasks with auto-titling", () => {
    it("creates a task without auto-titling when description is provided", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Add dark mode",
          description: "Should persist across sessions",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toMatchObject({
        ok: true,
        issue: {
          id: "test-123",
          title: "Add dark mode",
          description: "Should persist across sessions",
        },
      })

      // Auto-titling should NOT be triggered
      expect(mockParseTask).not.toHaveBeenCalled()
    })

    it("creates a task without auto-titling when priority is provided", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Add dark mode",
          priority: 1,
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Auto-titling should NOT be triggered
      expect(mockParseTask).not.toHaveBeenCalled()
    })

    it("creates a task without auto-titling when type is provided", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Add dark mode",
          type: "bug",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Auto-titling should NOT be triggered
      expect(mockParseTask).not.toHaveBeenCalled()
    })

    it("triggers auto-titling for quick input (title-only)", async () => {
      // Mock the parseTask to return a parsed result
      vi.mocked(mockParseTask).mockResolvedValueOnce({
        title: "Add dark mode",
        description: "Should persist across sessions and use system theme by default",
      })

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Add dark mode. Should persist across sessions and use system theme by default.",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Auto-titling should be triggered
      expect(mockParseTask).toHaveBeenCalledWith(
        "Add dark mode. Should persist across sessions and use system theme by default.",
      )

      // Broadcast should be called with task:updated event
      expect(broadcastCalls.length).toBeGreaterThan(0)
      const updateEvent = broadcastCalls.find((call: any) => call.type === "task:updated") as any
      expect(updateEvent).toBeDefined()
      expect(updateEvent.issue).toMatchObject({
        title: "Add dark mode",
        description: "Should persist across sessions and use system theme by default",
      })
    })

    it("does not update task if auto-titling returns same title and no description", async () => {
      // Mock the parseTask to return the same title with no description
      vi.mocked(mockParseTask).mockResolvedValueOnce({
        title: "Add dark mode",
        description: "",
      })

      const updateSpy = vi.spyOn(mockBdProxy, "update")

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Add dark mode",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Auto-titling should be triggered
      expect(mockParseTask).toHaveBeenCalledWith("Add dark mode")

      // But update should NOT be called since nothing changed
      expect(updateSpy).not.toHaveBeenCalled()

      // No broadcast should occur
      expect(broadcastCalls.length).toBe(0)
    })

    it("updates task if auto-titling returns different title", async () => {
      // Mock the parseTask to return a refined title
      vi.mocked(mockParseTask).mockResolvedValueOnce({
        title: "Fix duplicate submission bug on contact form",
        description:
          "Clicking the submit button twice causes duplicate submissions. This happens on the contact form page. We need to disable the button after the first click.",
      })

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            "Fix the bug where clicking the submit button twice causes duplicate submissions. This happens on the contact form page. We need to disable the button after the first click.",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Auto-titling should be triggered
      expect(mockParseTask).toHaveBeenCalled()

      // Broadcast should be called with task:updated event
      expect(broadcastCalls.length).toBeGreaterThan(0)
      const updateEvent = broadcastCalls.find((call: any) => call.type === "task:updated") as any
      expect(updateEvent).toBeDefined()
      expect(updateEvent.issue).toMatchObject({
        title: "Fix duplicate submission bug on contact form",
        description:
          "Clicking the submit button twice causes duplicate submissions. This happens on the contact form page. We need to disable the button after the first click.",
      })
    })

    it("updates task if auto-titling returns same title but adds description", async () => {
      // Mock the parseTask to return the same title but with a description
      vi.mocked(mockParseTask).mockResolvedValueOnce({
        title: "Add dark mode toggle to settings",
        description: "Should use system theme by default and persist across sessions",
      })

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            "Add dark mode toggle to settings. Should use system theme by default and persist across sessions.",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Auto-titling should be triggered
      expect(mockParseTask).toHaveBeenCalled()

      // Broadcast should be called with task:updated event
      expect(broadcastCalls.length).toBeGreaterThan(0)
      const updateEvent = broadcastCalls.find((call: any) => call.type === "task:updated") as any
      expect(updateEvent).toBeDefined()
      expect(updateEvent.issue.description).toBe(
        "Should use system theme by default and persist across sessions",
      )
    })

    it("handles auto-titling errors gracefully without failing task creation", async () => {
      // Mock the parseTask to throw an error
      vi.mocked(mockParseTask).mockRejectedValueOnce(new Error("Claude API error"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Add dark mode",
        }),
      })
      const data = await response.json()

      // Task creation should still succeed
      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)
      expect(data.issue.title).toBe("Add dark mode")

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[task-titling] Failed to auto-title task"),
        expect.any(Error),
      )

      consoleSpy.mockRestore()
    })

    it("returns 400 when title is missing", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Title is required" })
    })

    it("returns 400 when title is empty string", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Title is required" })
    })

    it("returns 400 when title is whitespace-only", async () => {
      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "   " }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ ok: false, error: "Title is required" })
    })
  })

  describe("Auto-titling edge cases", () => {
    it("handles very long titles gracefully", async () => {
      const longTitle = "A".repeat(500)

      vi.mocked(mockParseTask).mockResolvedValueOnce({
        title: longTitle.slice(0, 100), // Service should cap at 100 chars
        description: "",
      })

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: longTitle,
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockParseTask).toHaveBeenCalledWith(longTitle)
    })

    it("handles empty description from auto-titling", async () => {
      vi.mocked(mockParseTask).mockResolvedValueOnce({
        title: "Add feature X",
        description: "",
      })

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Add feature X",
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // No update should occur since nothing changed
      expect(broadcastCalls.length).toBe(0)
    })

    it("handles special characters in title", async () => {
      const specialTitle = 'Fix bug with <script> & "quotes" in title\'s text'

      vi.mocked(mockParseTask).mockResolvedValueOnce({
        title: specialTitle,
        description: "",
      })

      const response = await fetch(`http://localhost:${port}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: specialTitle,
        }),
      })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.ok).toBe(true)

      // Wait for async auto-titling to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockParseTask).toHaveBeenCalledWith(specialTitle)
    })
  })
})
