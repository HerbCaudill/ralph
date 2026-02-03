import { describe, it, expect, beforeEach } from "vitest"
import {
  listSessions,
  getSession,
  addSession,
  updateSession,
  removeSession,
  clearSessionIndex,
  type SessionIndexEntry,
} from ".././sessionIndex"

const STORAGE_KEY = "agent-view-session-index"

function makeEntry(overrides: Partial<SessionIndexEntry> = {}): SessionIndexEntry {
  return {
    sessionId: "s1",
    adapter: "claude",
    firstMessageAt: 1000,
    lastMessageAt: 2000,
    firstUserMessage: "Hello",
    ...overrides,
  }
}

describe("sessionIndex", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe("listSessions", () => {
    it("should return empty array when no data exists", () => {
      expect(listSessions()).toEqual([])
    })

    it("should return entries sorted by lastMessageAt descending", () => {
      const older = makeEntry({ sessionId: "s1", lastMessageAt: 1000 })
      const newer = makeEntry({ sessionId: "s2", lastMessageAt: 3000 })
      const middle = makeEntry({ sessionId: "s3", lastMessageAt: 2000 })

      localStorage.setItem(STORAGE_KEY, JSON.stringify([older, middle, newer]))

      const result = listSessions()
      expect(result.map(e => e.sessionId)).toEqual(["s2", "s3", "s1"])
    })

    it("should return empty array for corrupted JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not valid json{{{")
      expect(listSessions()).toEqual([])
    })

    it("should return empty array if stored value is not an array", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }))
      expect(listSessions()).toEqual([])
    })

    it("should return empty array if stored value is a string", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify("just a string"))
      expect(listSessions()).toEqual([])
    })
  })

  describe("getSession", () => {
    it("should return undefined when index is empty", () => {
      expect(getSession("nonexistent")).toBeUndefined()
    })

    it("should return undefined for a non-existing sessionId", () => {
      addSession(makeEntry({ sessionId: "s1" }))
      expect(getSession("s999")).toBeUndefined()
    })

    it("should return the matching entry", () => {
      const entry = makeEntry({ sessionId: "s1", firstUserMessage: "Hi there" })
      addSession(entry)
      expect(getSession("s1")).toEqual(entry)
    })
  })

  describe("addSession", () => {
    it("should add an entry to an empty index", () => {
      const entry = makeEntry({ sessionId: "s1" })
      addSession(entry)

      const sessions = listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toEqual(entry)
    })

    it("should add multiple entries", () => {
      addSession(makeEntry({ sessionId: "s1", lastMessageAt: 1000 }))
      addSession(makeEntry({ sessionId: "s2", lastMessageAt: 2000 }))
      addSession(makeEntry({ sessionId: "s3", lastMessageAt: 3000 }))

      expect(listSessions()).toHaveLength(3)
    })

    it("should replace an entry with the same sessionId", () => {
      addSession(makeEntry({ sessionId: "s1", firstUserMessage: "original" }))
      addSession(makeEntry({ sessionId: "s1", firstUserMessage: "replaced" }))

      const sessions = listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].firstUserMessage).toBe("replaced")
    })

    it("should persist to localStorage", () => {
      const entry = makeEntry()
      addSession(entry)

      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].sessionId).toBe(entry.sessionId)
    })
  })

  describe("updateSession", () => {
    it("should update lastMessageAt on an existing entry", () => {
      addSession(makeEntry({ sessionId: "s1", lastMessageAt: 1000 }))
      updateSession("s1", { lastMessageAt: 5000 })

      const session = getSession("s1")
      expect(session?.lastMessageAt).toBe(5000)
    })

    it("should preserve fields that are not updated", () => {
      const original = makeEntry({
        sessionId: "s1",
        firstUserMessage: "Hello",
        adapter: "claude",
        firstMessageAt: 100,
        lastMessageAt: 200,
      })
      addSession(original)
      updateSession("s1", { lastMessageAt: 999 })

      const session = getSession("s1")
      expect(session?.firstUserMessage).toBe("Hello")
      expect(session?.adapter).toBe("claude")
      expect(session?.firstMessageAt).toBe(100)
      expect(session?.lastMessageAt).toBe(999)
    })

    it("should be a no-op when sessionId does not exist", () => {
      addSession(makeEntry({ sessionId: "s1" }))
      updateSession("nonexistent", { lastMessageAt: 9999 })

      const sessions = listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].sessionId).toBe("s1")
    })

    it("should be a no-op on an empty index", () => {
      updateSession("nonexistent", { lastMessageAt: 9999 })
      expect(listSessions()).toEqual([])
    })

    it("should allow updating multiple fields at once", () => {
      addSession(makeEntry({ sessionId: "s1", adapter: "claude", lastMessageAt: 100 }))
      updateSession("s1", { adapter: "codex", lastMessageAt: 500 })

      const session = getSession("s1")
      expect(session?.adapter).toBe("codex")
      expect(session?.lastMessageAt).toBe(500)
    })
  })

  describe("removeSession", () => {
    it("should remove an existing entry", () => {
      addSession(makeEntry({ sessionId: "s1" }))
      addSession(makeEntry({ sessionId: "s2" }))

      removeSession("s1")

      const sessions = listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].sessionId).toBe("s2")
    })

    it("should be a no-op when sessionId does not exist", () => {
      addSession(makeEntry({ sessionId: "s1" }))
      removeSession("nonexistent")

      expect(listSessions()).toHaveLength(1)
    })

    it("should be a no-op on an empty index", () => {
      removeSession("nonexistent")
      expect(listSessions()).toEqual([])
    })
  })

  describe("clearSessionIndex", () => {
    it("should remove all entries", () => {
      addSession(makeEntry({ sessionId: "s1" }))
      addSession(makeEntry({ sessionId: "s2" }))
      addSession(makeEntry({ sessionId: "s3" }))

      clearSessionIndex()

      expect(listSessions()).toEqual([])
    })

    it("should be safe to call on an empty index", () => {
      clearSessionIndex()
      expect(listSessions()).toEqual([])
    })

    it("should remove the key from localStorage", () => {
      addSession(makeEntry({ sessionId: "s1" }))
      clearSessionIndex()

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })
})
