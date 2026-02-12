import { describe, expect, it, vi, beforeEach } from "vitest"
import { fetchSessionEvents } from "../fetchSessionEvents"
import type { ChatEvent } from "@herbcaudill/agent-view"

describe("fetchSessionEvents", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches and returns events for a session", async () => {
    const mockEvents: ChatEvent[] = [
      { type: "user_message", message: "Hello", timestamp: 1000 },
      { type: "assistant", timestamp: 2000 },
    ]

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: mockEvents }),
    })

    const result = await fetchSessionEvents("session-123", { fetchFn: mockFetch })

    expect(result).toEqual(mockEvents)
    expect(mockFetch).toHaveBeenCalledWith("/api/sessions/session-123/events")
  })

  it("returns empty array when fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const result = await fetchSessionEvents("session-123", { fetchFn: mockFetch })

    expect(result).toEqual([])
  })

  it("returns empty array when response has no events", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await fetchSessionEvents("session-123", { fetchFn: mockFetch })

    expect(result).toEqual([])
  })

  it("uses custom baseUrl when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    })

    await fetchSessionEvents("session-123", {
      fetchFn: mockFetch,
      baseUrl: "http://localhost:4244",
    })

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:4244/api/sessions/session-123/events")
  })

  it("handles network errors gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"))

    const result = await fetchSessionEvents("session-123", { fetchFn: mockFetch })

    expect(result).toEqual([])
  })
})
