import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getIterationState,
  restoreIterationState,
  deleteIterationState,
  checkForSavedIterationState,
  type IterationState,
} from "./iterationStateApi"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock useAppStore
vi.mock("../store", () => ({
  useAppStore: {
    getState: () => ({
      activeInstanceId: "test-instance",
    }),
  },
}))

describe("iterationStateApi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress expected console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getIterationState", () => {
    it("returns saved state when available", async () => {
      const savedState: IterationState = {
        instanceId: "test-1",
        status: "running",
        currentTaskId: "task-1",
        savedAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        conversationContext: {
          messages: [{ role: "user", content: "hello" }],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, state: savedState }),
      })

      const result = await getIterationState("test-1")

      expect(mockFetch).toHaveBeenCalledWith("/api/ralph/test-1/iteration-state")
      expect(result).toEqual(savedState)
    })

    it("returns null when no state exists (404)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ ok: false, error: "Not found" }),
      })

      const result = await getIterationState("test-1")

      expect(result).toBeNull()
    })

    it("returns null when state is too old (> 1 hour)", async () => {
      const oldState: IterationState = {
        instanceId: "test-1",
        status: "running",
        currentTaskId: "task-1",
        savedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        conversationContext: {
          messages: [{ role: "user", content: "hello" }],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, state: oldState }),
      })

      const result = await getIterationState("test-1")

      expect(result).toBeNull()
    })

    it("returns null on fetch error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await getIterationState("test-1")

      expect(result).toBeNull()
    })

    it("handles server error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ ok: false, error: "Internal error" }),
      })

      const result = await getIterationState("test-1")

      expect(result).toBeNull()
    })

    it("encodes instance ID in URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ ok: false }),
      })

      await getIterationState("instance/with/slashes")

      expect(mockFetch).toHaveBeenCalledWith("/api/ralph/instance%2Fwith%2Fslashes/iteration-state")
    })
  })

  describe("restoreIterationState", () => {
    it("calls restore endpoint successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          restored: {
            instanceId: "test-1",
            status: "running",
            currentTaskId: "task-1",
            savedAt: Date.now(),
            messageCount: 5,
          },
        }),
      })

      const result = await restoreIterationState("test-1")

      expect(mockFetch).toHaveBeenCalledWith("/api/ralph/test-1/restore-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      expect(result).toEqual({ ok: true })
    })

    it("returns error when restore fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: false,
          error: "No saved state found",
        }),
      })

      const result = await restoreIterationState("test-1")

      expect(result).toEqual({ ok: false, error: "No saved state found" })
    })

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await restoreIterationState("test-1")

      expect(result.ok).toBe(false)
      expect(result.error).toBe("Network error")
    })
  })

  describe("deleteIterationState", () => {
    it("calls delete endpoint successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

      const result = await deleteIterationState("test-1")

      expect(mockFetch).toHaveBeenCalledWith("/api/ralph/test-1/iteration-state", {
        method: "DELETE",
      })
      expect(result).toEqual({ ok: true })
    })

    it("returns ok when no state to delete (404)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ ok: false, error: "Not found" }),
      })

      const result = await deleteIterationState("test-1")

      expect(result).toEqual({ ok: true })
    })

    it("returns error when delete fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 500,
        json: async () => ({
          ok: false,
          error: "Failed to delete state",
        }),
      })

      const result = await deleteIterationState("test-1")

      expect(result).toEqual({ ok: false, error: "Failed to delete state" })
    })

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const result = await deleteIterationState("test-1")

      expect(result.ok).toBe(false)
      expect(result.error).toBe("Network error")
    })
  })

  describe("checkForSavedIterationState", () => {
    it("uses provided instanceId", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ ok: false }),
      })

      await checkForSavedIterationState("specific-instance")

      expect(mockFetch).toHaveBeenCalledWith("/api/ralph/specific-instance/iteration-state")
    })

    it("uses active instance ID when none provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ ok: false }),
      })

      await checkForSavedIterationState()

      expect(mockFetch).toHaveBeenCalledWith("/api/ralph/test-instance/iteration-state")
    })
  })
})
