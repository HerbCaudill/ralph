import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { ChatEvent, AssistantChatEvent } from "@herbcaudill/agent-view"

// We'll import the actual functions after creating them
import {
  extractTaskIdFromEvents,
  getSessionTaskId,
  setSessionTaskId,
  STORAGE_KEY,
} from "../sessionTaskIdCache"

describe("sessionTaskIdCache", () => {
  describe("extractTaskIdFromEvents", () => {
    it("returns undefined for empty events array", () => {
      expect(extractTaskIdFromEvents([])).toBeUndefined()
    })

    it("returns undefined when no task lifecycle events exist", () => {
      const events: ChatEvent[] = [
        { type: "user_message", message: "Hello", timestamp: 1000 },
        {
          type: "assistant",
          timestamp: 1100,
          message: { content: [{ type: "text", text: "Hi there" }] },
        } as AssistantChatEvent,
      ]
      expect(extractTaskIdFromEvents(events)).toBeUndefined()
    })

    it("extracts taskId from a start_task marker in an assistant event", () => {
      const events: ChatEvent[] = [
        { type: "user_message", message: "Start working", timestamp: 1000 },
        {
          type: "assistant",
          timestamp: 1100,
          message: {
            content: [{ type: "text", text: "<start_task>r-abc123</start_task>" }],
          },
        } as AssistantChatEvent,
      ]
      expect(extractTaskIdFromEvents(events)).toBe("r-abc123")
    })

    it("returns the first start_task when multiple exist", () => {
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: 1000,
          message: {
            content: [{ type: "text", text: "<start_task>r-first</start_task>" }],
          },
        } as AssistantChatEvent,
        {
          type: "assistant",
          timestamp: 2000,
          message: {
            content: [{ type: "text", text: "<start_task>r-second</start_task>" }],
          },
        } as AssistantChatEvent,
      ]
      expect(extractTaskIdFromEvents(events)).toBe("r-first")
    })

    it("handles subtask IDs", () => {
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: 1000,
          message: {
            content: [{ type: "text", text: "<start_task>r-abc123.5</start_task>" }],
          },
        } as AssistantChatEvent,
      ]
      expect(extractTaskIdFromEvents(events)).toBe("r-abc123.5")
    })

    it("ignores end_task markers (only looks for start_task)", () => {
      const events: ChatEvent[] = [
        {
          type: "assistant",
          timestamp: 1000,
          message: {
            content: [{ type: "text", text: "<end_task>r-abc123</end_task>" }],
          },
        } as AssistantChatEvent,
      ]
      expect(extractTaskIdFromEvents(events)).toBeUndefined()
    })

    it("ignores non-assistant events with task markers", () => {
      const events: ChatEvent[] = [
        {
          type: "user_message",
          message: "<start_task>r-abc123</start_task>",
          timestamp: 1000,
        },
      ]
      expect(extractTaskIdFromEvents(events)).toBeUndefined()
    })
  })

  describe("getSessionTaskId / setSessionTaskId", () => {
    let storage: Record<string, string>

    beforeEach(() => {
      storage = {}
      vi.stubGlobal("localStorage", {
        getItem: vi.fn((key: string) => storage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete storage[key]
        }),
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it("returns undefined when no cache exists", () => {
      expect(getSessionTaskId("session-1")).toBeUndefined()
    })

    it("returns undefined when session is not in cache", () => {
      storage[STORAGE_KEY] = JSON.stringify({ "other-session": "r-abc" })
      expect(getSessionTaskId("session-1")).toBeUndefined()
    })

    it("returns cached taskId for a session", () => {
      storage[STORAGE_KEY] = JSON.stringify({ "session-1": "r-abc123" })
      expect(getSessionTaskId("session-1")).toBe("r-abc123")
    })

    it("stores a taskId for a session", () => {
      setSessionTaskId("session-1", "r-abc123")
      const stored = JSON.parse(storage[STORAGE_KEY])
      expect(stored["session-1"]).toBe("r-abc123")
    })

    it("preserves existing entries when adding a new one", () => {
      storage[STORAGE_KEY] = JSON.stringify({ "session-1": "r-abc" })
      setSessionTaskId("session-2", "r-def")
      const stored = JSON.parse(storage[STORAGE_KEY])
      expect(stored["session-1"]).toBe("r-abc")
      expect(stored["session-2"]).toBe("r-def")
    })

    it("overwrites an existing entry for the same session", () => {
      storage[STORAGE_KEY] = JSON.stringify({ "session-1": "r-old" })
      setSessionTaskId("session-1", "r-new")
      const stored = JSON.parse(storage[STORAGE_KEY])
      expect(stored["session-1"]).toBe("r-new")
    })

    it("handles corrupted localStorage gracefully in getSessionTaskId", () => {
      storage[STORAGE_KEY] = "not-valid-json"
      expect(getSessionTaskId("session-1")).toBeUndefined()
    })

    it("handles corrupted localStorage gracefully in setSessionTaskId", () => {
      storage[STORAGE_KEY] = "not-valid-json"
      // Should not throw
      setSessionTaskId("session-1", "r-abc123")
      const stored = JSON.parse(storage[STORAGE_KEY])
      expect(stored["session-1"]).toBe("r-abc123")
    })
  })
})
