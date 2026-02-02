import { describe, it, expect, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { SessionPersister } from ".././SessionPersister.js"

describe("SessionPersister", () => {
  let storageDir: string
  let persister: SessionPersister

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "persister-test-"))
    persister = new SessionPersister(storageDir)
  })

  describe("readSessionMetadata", () => {
    it("returns correct metadata from a session_created event", async () => {
      const sessionId = "test-session-1"
      const createdAt = 1700000000000

      // Write a session_created event as the first line
      await persister.appendEvent(sessionId, {
        type: "session_created",
        sessionId,
        adapter: "claude",
        cwd: "/some/working/dir",
        timestamp: createdAt,
      })

      // Add a subsequent event to ensure we only read the first
      await persister.appendEvent(sessionId, {
        type: "user_message",
        message: "Hello",
        timestamp: createdAt + 1000,
      })

      const metadata = persister.readSessionMetadata(sessionId)

      expect(metadata).not.toBeNull()
      expect(metadata!.adapter).toBe("claude")
      expect(metadata!.cwd).toBe("/some/working/dir")
      expect(metadata!.createdAt).toBe(createdAt)
    })

    it("returns null for a non-existent session", () => {
      const metadata = persister.readSessionMetadata("does-not-exist")
      expect(metadata).toBeNull()
    })

    it("returns null for an empty file", () => {
      // Write an empty file directly
      const filePath = join(storageDir, "empty-session.jsonl")
      writeFileSync(filePath, "", "utf-8")

      const metadata = persister.readSessionMetadata("empty-session")
      expect(metadata).toBeNull()
    })

    it("returns null when the first event is not session_created", async () => {
      const sessionId = "no-creation-event"

      // Write a user_message as the first event (no session_created)
      await persister.appendEvent(sessionId, {
        type: "user_message",
        message: "Hello",
        timestamp: Date.now(),
      })

      const metadata = persister.readSessionMetadata(sessionId)
      expect(metadata).toBeNull()
    })

    it("defaults adapter to 'claude' when not present in event", () => {
      const sessionId = "missing-adapter"
      const filePath = join(storageDir, `${sessionId}.jsonl`)

      // Write a session_created event without an adapter field
      writeFileSync(filePath, JSON.stringify({ type: "session_created", timestamp: 1234 }) + "\n")

      const metadata = persister.readSessionMetadata(sessionId)

      expect(metadata).not.toBeNull()
      expect(metadata!.adapter).toBe("claude")
      expect(metadata!.createdAt).toBe(1234)
    })

    it("defaults createdAt to 0 when timestamp is missing", () => {
      const sessionId = "missing-timestamp"
      const filePath = join(storageDir, `${sessionId}.jsonl`)

      // Write a session_created event without a timestamp
      writeFileSync(filePath, JSON.stringify({ type: "session_created", adapter: "stub" }) + "\n")

      const metadata = persister.readSessionMetadata(sessionId)

      expect(metadata).not.toBeNull()
      expect(metadata!.adapter).toBe("stub")
      expect(metadata!.createdAt).toBe(0)
    })

    it("returns null for a file with invalid JSON", () => {
      const sessionId = "bad-json"
      const filePath = join(storageDir, `${sessionId}.jsonl`)

      writeFileSync(filePath, "this is not json\n", "utf-8")

      const metadata = persister.readSessionMetadata(sessionId)
      expect(metadata).toBeNull()
    })
  })
})
