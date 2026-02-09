import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getSessionSummary } from "../getSessionSummary.js"
import type { SessionPersister } from "../../SessionPersister.js"

describe("getSessionSummary", () => {
  const createMockPersister = (events: Array<Record<string, unknown>>): SessionPersister =>
    ({
      readEvents: vi.fn().mockResolvedValue(events),
    }) as unknown as SessionPersister

  it("returns null for empty events", async () => {
    const persister = createMockPersister([])
    const result = await getSessionSummary("session-123", persister)

    expect(result).toBeNull()
  })

  it("returns null when no task lifecycle events exist", async () => {
    const persister = createMockPersister([
      { type: "session_created", timestamp: 1000 },
      { type: "user_message", message: "Hello", timestamp: 1001 },
      { type: "message", content: "Hi there", timestamp: 1002 },
    ])
    const result = await getSessionSummary("session-123", persister)

    expect(result).toBeNull()
  })

  it("extracts taskId from start_task tag in message content", async () => {
    const persister = createMockPersister([
      { type: "session_created", timestamp: 1000 },
      { type: "user_message", message: "Start working", timestamp: 1001 },
      {
        type: "message",
        content: "I'll work on this task. <start_task>r-abc123</start_task>",
        timestamp: 1002,
      },
    ])
    const result = await getSessionSummary("session-123", persister)

    expect(result).toEqual({ taskId: "r-abc123" })
  })

  it("extracts taskId from content_block_delta text", async () => {
    const persister = createMockPersister([
      { type: "session_created", timestamp: 1000 },
      {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "<start_task>r-xyz789</start_task>" },
        timestamp: 1001,
      },
    ])
    const result = await getSessionSummary("session-123", persister)

    expect(result).toEqual({ taskId: "r-xyz789" })
  })

  it("extracts taskId from assistant text block", async () => {
    const persister = createMockPersister([
      { type: "session_created", timestamp: 1000 },
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Working on <start_task>r-task1</start_task>" }],
        },
        timestamp: 1001,
      },
    ])
    const result = await getSessionSummary("session-123", persister)

    expect(result).toEqual({ taskId: "r-task1" })
  })

  it("returns only the first task ID when multiple exist", async () => {
    const persister = createMockPersister([
      { type: "session_created", timestamp: 1000 },
      {
        type: "message",
        content: "<start_task>r-first</start_task>",
        timestamp: 1001,
      },
      {
        type: "message",
        content: "<start_task>r-second</start_task>",
        timestamp: 1002,
      },
    ])
    const result = await getSessionSummary("session-123", persister)

    expect(result).toEqual({ taskId: "r-first" })
  })

  it("handles subtask IDs", async () => {
    const persister = createMockPersister([
      {
        type: "message",
        content: "<start_task>r-abc123.5</start_task>",
        timestamp: 1000,
      },
    ])
    const result = await getSessionSummary("session-123", persister)

    expect(result).toEqual({ taskId: "r-abc123.5" })
  })

  it("passes the correct app parameter to readEvents", async () => {
    const readEventsSpy = vi.fn().mockResolvedValue([])
    const persister = { readEvents: readEventsSpy } as unknown as SessionPersister

    await getSessionSummary("session-123", persister, "ralph")

    expect(readEventsSpy).toHaveBeenCalledWith("session-123", "ralph")
  })
})
