import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import "fake-indexeddb/auto"
import { saveEventLogAndAddComment } from "./saveEventLogAndAddComment"
import { eventDatabase } from "@/lib/persistence"
import type { ChatEvent } from "@/types"

describe("saveEventLogAndAddComment", () => {
  beforeEach(async () => {
    await eventDatabase.init()
    // Mock fetch for the comment API
    vi.spyOn(global, "fetch")
  })

  afterEach(async () => {
    await eventDatabase.clearAll()
    eventDatabase.close()
    vi.restoreAllMocks()
  })

  describe("saving event logs to IndexedDB", () => {
    it("returns null when events array is empty", async () => {
      const result = await saveEventLogAndAddComment("task-1", "Test Task", [], null)
      expect(result).toBeNull()
    })

    it("saves event log to IndexedDB and returns the generated ID", async () => {
      const events: ChatEvent[] = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
        { type: "assistant_text", timestamp: Date.now() + 1, content: "Hi there!" },
      ]

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

      const eventLogId = await saveEventLogAndAddComment(
        "task-123",
        "Test Task",
        events,
        "/Users/test/project",
      )

      expect(eventLogId).not.toBeNull()
      expect(eventLogId).toMatch(/^event-log-\d+-[a-z0-9]+$/)

      // Verify the event log was saved to IndexedDB
      const savedLog = await eventDatabase.getEventLog(eventLogId!)
      expect(savedLog).toBeDefined()
      expect(savedLog!.taskId).toBe("task-123")
      expect(savedLog!.taskTitle).toBe("Test Task")
      expect(savedLog!.source).toBe("task-close")
      expect(savedLog!.workspacePath).toBe("/Users/test/project")
      expect(savedLog!.eventCount).toBe(2)
      expect(savedLog!.events).toHaveLength(2)
    })

    it("saves event log with null workspacePath", async () => {
      const events: ChatEvent[] = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
      ]

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

      const eventLogId = await saveEventLogAndAddComment("task-456", "Another Task", events, null)

      expect(eventLogId).not.toBeNull()

      const savedLog = await eventDatabase.getEventLog(eventLogId!)
      expect(savedLog).toBeDefined()
      expect(savedLog!.workspacePath).toBeNull()
    })

    it("event log can be retrieved by task ID", async () => {
      const events: ChatEvent[] = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
      ]

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

      const eventLogId = await saveEventLogAndAddComment(
        "task-789",
        "Task Title",
        events,
        "/workspace",
      )

      const logsForTask = await eventDatabase.getEventLogsForTask("task-789")
      expect(logsForTask).toHaveLength(1)
      expect(logsForTask[0].id).toBe(eventLogId)
    })
  })

  describe("adding comments via API", () => {
    it("calls the comments API with the event log ID", async () => {
      const events: ChatEvent[] = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
      ]

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

      const eventLogId = await saveEventLogAndAddComment(
        "task-abc",
        "Test Task",
        events,
        "/workspace",
      )

      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks/task-abc/comments",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining(`#eventlog=${eventLogId}`),
        }),
      )
    })

    it("includes 'Closed. Event log:' prefix in the comment", async () => {
      const events: ChatEvent[] = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
      ]

      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

      await saveEventLogAndAddComment("task-def", "Test Task", events, "/workspace")

      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks/task-def/comments",
        expect.objectContaining({
          body: expect.stringContaining("Closed. Event log:"),
        }),
      )
    })

    it("logs error when comment API fails but still returns event log ID", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const events: ChatEvent[] = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
      ]

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Server error", { status: 500, statusText: "Internal Server Error" }),
      )

      const eventLogId = await saveEventLogAndAddComment(
        "task-ghi",
        "Test Task",
        events,
        "/workspace",
      )

      // Event log should still be saved
      expect(eventLogId).not.toBeNull()
      const savedLog = await eventDatabase.getEventLog(eventLogId!)
      expect(savedLog).toBeDefined()

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith("Failed to add closing comment:", expect.any(String))
    })
  })

  describe("error handling", () => {
    it("returns null and logs error when IndexedDB save fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      // Close the database to cause save to fail
      eventDatabase.close()

      const events: ChatEvent[] = [
        { type: "user_message", timestamp: Date.now(), message: "Hello" },
      ]

      const result = await saveEventLogAndAddComment("task-xyz", "Test Task", events, "/workspace")

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith("Error saving event log:", expect.any(Error))
    })
  })
})
