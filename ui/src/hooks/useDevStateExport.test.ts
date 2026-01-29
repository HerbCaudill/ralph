import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useDevStateExport } from "./useDevStateExport"
import type { ChatEvent } from "@/types"

// Mock getSessionBoundaries from store
const mockGetSessionBoundaries = vi.fn<(events: ChatEvent[]) => number[]>()
vi.mock("@/store", () => ({
  getSessionBoundaries: (...args: unknown[]) => mockGetSessionBoundaries(...(args as [ChatEvent[]])),
}))

// Mock global fetch
const mockFetch = vi.fn<typeof fetch>()

describe("useDevStateExport", () => {
  const createSessionStartEvent = (timestamp: number, session: number = 1): ChatEvent =>
    ({
      type: "ralph_session_start",
      timestamp,
      sessionId: `session-${session}`,
      session,
      totalSessions: 5,
    }) as ChatEvent

  const createAssistantEvent = (timestamp: number, text: string): ChatEvent => ({
    type: "assistant",
    timestamp,
    message: {
      content: [{ type: "text", text }],
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mockFetch)
    mockGetSessionBoundaries.mockReturnValue([])
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true, savedAt: Date.now() }), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does nothing when enabled is false", () => {
    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    renderHook(() => useDevStateExport({ events, enabled: false }))

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("does nothing when there are no session boundaries", () => {
    const events = [createAssistantEvent(1000, "hello")]
    mockGetSessionBoundaries.mockReturnValue([])

    renderHook(() => useDevStateExport({ events, enabled: true }))

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("fires POST to /api/state/export when a new session boundary appears", () => {
    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    renderHook(() => useDevStateExport({ events, enabled: true }))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith("/api/state/export", { method: "POST" })
  })

  it("does not re-fire for the same boundary count on rerender", () => {
    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    const { rerender } = renderHook(
      ({ events, enabled }) => useDevStateExport({ events, enabled }),
      { initialProps: { events, enabled: true } },
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Rerender with same events — should not fire again
    rerender({ events: [...events], enabled: true })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("fires again when a new boundary is added", () => {
    const events1 = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    const { rerender } = renderHook(
      ({ events, enabled }) => useDevStateExport({ events, enabled }),
      { initialProps: { events: events1, enabled: true } },
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Add a second session boundary
    const events2 = [
      createSessionStartEvent(1000),
      createAssistantEvent(2000, "hello"),
      createSessionStartEvent(3000, 2),
    ]
    mockGetSessionBoundaries.mockReturnValue([0, 2])

    rerender({ events: events2, enabled: true })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("handles 403 response gracefully (not in dev mode)", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
    mockFetch.mockResolvedValue(new Response(null, { status: 403 }))

    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    renderHook(() => useDevStateExport({ events, enabled: true }))

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Wait for the async .then chain to settle
    await vi.waitFor(() => {
      expect(debugSpy).toHaveBeenCalledWith("[useDevStateExport] Skipped: not in dev mode")
    })

    debugSpy.mockRestore()
  })

  it("handles fetch network errors gracefully", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const networkError = new Error("Network failure")
    mockFetch.mockRejectedValue(networkError)

    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    renderHook(() => useDevStateExport({ events, enabled: true }))

    expect(mockFetch).toHaveBeenCalledTimes(1)

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDevStateExport] Export request failed:",
        networkError,
      )
    })

    warnSpy.mockRestore()
  })

  it("handles non-OK response with error body gracefully", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
    )

    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    renderHook(() => useDevStateExport({ events, enabled: true }))

    expect(mockFetch).toHaveBeenCalledTimes(1)

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "[useDevStateExport] Export failed: Internal server error",
      )
    })

    warnSpy.mockRestore()
  })

  it("logs success on OK response", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})
    const savedAt = 1700000000000
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, savedAt }), { status: 200 }),
    )

    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    renderHook(() => useDevStateExport({ events, enabled: true }))

    await vi.waitFor(() => {
      expect(debugSpy).toHaveBeenCalledWith(
        `[useDevStateExport] State exported to .ralph/state.latest.json (savedAt: ${savedAt})`,
      )
    })

    debugSpy.mockRestore()
  })

  it("defaults enabled to true when not specified", () => {
    const events = [createSessionStartEvent(1000)]
    mockGetSessionBoundaries.mockReturnValue([0])

    renderHook(() => useDevStateExport({ events }))

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
