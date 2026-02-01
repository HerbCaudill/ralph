import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { linkSessionToTask } from "@herbcaudill/beads-view"
import { saveEventLogAndAddComment } from "./saveEventLogAndAddComment"

describe("linkSessionToTask", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("linking sessions to tasks", () => {
    it("returns false when sessionId is null", async () => {
      const result = await linkSessionToTask("task-1", null)
      expect(result).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })

    it("calls the comments API with the session ID", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

      const result = await linkSessionToTask("task-abc", "session-123")

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks/task-abc/comments",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("/session/session-123"),
        }),
      )
    })

    it("includes 'Closed. Session log:' prefix in the comment", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

      await linkSessionToTask("task-def", "session-456")

      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks/task-def/comments",
        expect.objectContaining({
          body: expect.stringContaining("Closed. Session log:"),
        }),
      )
    })

    it("returns false and logs error when comment API fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Server error", { status: 500, statusText: "Internal Server Error" }),
      )

      const result = await linkSessionToTask("task-ghi", "session-789")

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith("Failed to add closing comment:", expect.any(String))
    })

    it("returns false and logs error on network error", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"))

      const result = await linkSessionToTask("task-jkl", "session-abc")

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith("Error linking session to task:", expect.any(Error))
    })
  })
})

describe("saveEventLogAndAddComment (deprecated)", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns null when events array is empty and no sessionId", async () => {
    const result = await saveEventLogAndAddComment("task-1", "Test Task", [], null)
    expect(result).toBeNull()
  })

  it("delegates to linkSessionToTask when sessionId is provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))

    const result = await saveEventLogAndAddComment("task-123", "Test Task", [], null, "session-xyz")

    expect(result).toBe("session-xyz")
    expect(fetch).toHaveBeenCalledWith(
      "/api/tasks/task-123/comments",
      expect.objectContaining({
        body: expect.stringContaining("/session/session-xyz"),
      }),
    )
  })

  it("returns null when linkSessionToTask fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Server error", { status: 500, statusText: "Internal Server Error" }),
    )
    vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await saveEventLogAndAddComment("task-456", "Test Task", [], null, "session-abc")

    expect(result).toBeNull()
  })
})
