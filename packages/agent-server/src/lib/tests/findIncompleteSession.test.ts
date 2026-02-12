import { describe, it, expect, beforeEach } from "vitest"
import { tmpdir } from "node:os"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { findIncompleteSession } from "../findIncompleteSession.js"

describe("findIncompleteSession", () => {
  let storageDir: string

  beforeEach(() => {
    storageDir = mkdtempSync(join(tmpdir(), "find-incomplete-test-"))
  })

  describe("no matching sessions", () => {
    it("returns null when storage directory is empty", () => {
      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBeNull()
    })

    it("returns null when no sessions reference the task", () => {
      // Create app directory
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      // Create a session that works on a different task
      const sessionId = "session-other"
      const filePath = join(appDir, `${sessionId}.jsonl`)
      writeFileSync(
        filePath,
        [
          JSON.stringify({ type: "session_created", sessionId, timestamp: Date.now() }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-different</start_task>",
            timestamp: Date.now(),
          }),
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBeNull()
    })
  })

  describe("complete session exists", () => {
    it("returns null when session has <end_task> marker", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      const sessionId = "session-complete"
      const filePath = join(appDir, `${sessionId}.jsonl`)
      writeFileSync(
        filePath,
        [
          JSON.stringify({ type: "session_created", sessionId, timestamp: Date.now() }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-abc123</start_task>",
            timestamp: Date.now(),
          }),
          JSON.stringify({
            type: "assistant_message",
            text: "Working on the task...",
            timestamp: Date.now(),
          }),
          JSON.stringify({
            type: "assistant_message",
            text: "<end_task>task-abc123</end_task>",
            timestamp: Date.now(),
          }),
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBeNull()
    })
  })

  describe("incomplete session exists", () => {
    it("returns sessionId when session has <start_task> but no <end_task>", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      const sessionId = "session-incomplete"
      const filePath = join(appDir, `${sessionId}.jsonl`)
      writeFileSync(
        filePath,
        [
          JSON.stringify({ type: "session_created", sessionId, timestamp: Date.now() }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-abc123</start_task>",
            timestamp: Date.now(),
          }),
          JSON.stringify({
            type: "assistant_message",
            text: "Working on the task...",
            timestamp: Date.now(),
          }),
          // No end_task marker - session was interrupted
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBe(sessionId)
    })

    it("handles start_task marker with surrounding text", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      const sessionId = "session-with-context"
      const filePath = join(appDir, `${sessionId}.jsonl`)
      writeFileSync(
        filePath,
        [
          JSON.stringify({ type: "session_created", sessionId, timestamp: Date.now() }),
          JSON.stringify({
            type: "assistant_message",
            text: "I found a task to work on.\n<start_task>task-abc123</start_task>\nLet me begin.",
            timestamp: Date.now(),
          }),
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBe(sessionId)
    })
  })

  describe("multiple sessions for same task", () => {
    it("returns the incomplete session when one complete and one incomplete exist", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      // Create a complete session
      const completeSessionId = "session-complete"
      writeFileSync(
        join(appDir, `${completeSessionId}.jsonl`),
        [
          JSON.stringify({ type: "session_created", sessionId: completeSessionId, timestamp: 1000 }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-abc123</start_task>",
            timestamp: 1001,
          }),
          JSON.stringify({
            type: "assistant_message",
            text: "<end_task>task-abc123</end_task>",
            timestamp: 1002,
          }),
        ].join("\n"),
      )

      // Create an incomplete session (newer)
      const incompleteSessionId = "session-incomplete"
      writeFileSync(
        join(appDir, `${incompleteSessionId}.jsonl`),
        [
          JSON.stringify({
            type: "session_created",
            sessionId: incompleteSessionId,
            timestamp: 2000,
          }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-abc123</start_task>",
            timestamp: 2001,
          }),
          // No end_task - incomplete
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBe(incompleteSessionId)
    })

    it("returns the most recent incomplete session when multiple incomplete exist", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      // Create first incomplete session (older)
      const olderSessionId = "session-older"
      writeFileSync(
        join(appDir, `${olderSessionId}.jsonl`),
        [
          JSON.stringify({ type: "session_created", sessionId: olderSessionId, timestamp: 1000 }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-abc123</start_task>",
            timestamp: 1001,
          }),
        ].join("\n"),
      )

      // Create second incomplete session (newer)
      const newerSessionId = "session-newer"
      writeFileSync(
        join(appDir, `${newerSessionId}.jsonl`),
        [
          JSON.stringify({ type: "session_created", sessionId: newerSessionId, timestamp: 2000 }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-abc123</start_task>",
            timestamp: 2001,
          }),
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBe(newerSessionId)
    })
  })

  describe("task ID patterns", () => {
    it("matches task IDs with subtask notation (e.g., task-abc123.1)", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      const sessionId = "session-subtask"
      writeFileSync(
        join(appDir, `${sessionId}.jsonl`),
        [
          JSON.stringify({ type: "session_created", sessionId, timestamp: Date.now() }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>r-abc123.2</start_task>",
            timestamp: Date.now(),
          }),
        ].join("\n"),
      )

      const result = findIncompleteSession("r-abc123.2", "ralph", storageDir)
      expect(result).toBe(sessionId)
    })

    it("matches task IDs case-insensitively", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      const sessionId = "session-case"
      writeFileSync(
        join(appDir, `${sessionId}.jsonl`),
        [
          JSON.stringify({ type: "session_created", sessionId, timestamp: Date.now() }),
          JSON.stringify({
            type: "assistant_message",
            text: "<START_TASK>task-ABC123</START_TASK>",
            timestamp: Date.now(),
          }),
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBe(sessionId)
    })
  })

  describe("workspace-scoped sessions", () => {
    it("finds incomplete session in workspace directory", () => {
      // Create workspace-scoped app directory: storageDir/{owner}/{repo}/{app}/
      const workspaceDir = join(storageDir, "owner", "repo", "ralph")
      mkdirSync(workspaceDir, { recursive: true })

      const sessionId = "session-workspace"
      writeFileSync(
        join(workspaceDir, `${sessionId}.jsonl`),
        [
          JSON.stringify({ type: "session_created", sessionId, timestamp: Date.now() }),
          JSON.stringify({
            type: "assistant_message",
            text: "<start_task>task-abc123</start_task>",
            timestamp: Date.now(),
          }),
        ].join("\n"),
      )

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBe(sessionId)
    })
  })

  describe("edge cases", () => {
    it("handles empty JSONL files gracefully", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      writeFileSync(join(appDir, "empty-session.jsonl"), "")

      const result = findIncompleteSession("task-abc123", "ralph", storageDir)
      expect(result).toBeNull()
    })

    it("handles malformed JSON lines gracefully", () => {
      const appDir = join(storageDir, "ralph")
      mkdirSync(appDir, { recursive: true })

      writeFileSync(
        join(appDir, "bad-session.jsonl"),
        ["not valid json", '{"type": "session_created"}'].join("\n"),
      )

      // Should not throw, just skip the bad line
      expect(() => findIncompleteSession("task-abc123", "ralph", storageDir)).not.toThrow()
    })

    it("handles non-existent storage directory", () => {
      const result = findIncompleteSession("task-abc123", "ralph", "/nonexistent/path")
      expect(result).toBeNull()
    })
  })
})
