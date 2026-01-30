import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { TaskChatEventLog, type TaskChatLogEntry } from "./TaskChatEventLog.js"
import type { TaskChatEvent } from "./TaskChatManager.js"

describe("TaskChatEventLog", () => {
  let testDir: string
  let logger: TaskChatEventLog

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(
      tmpdir(),
      `task-chat-log-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    await mkdir(testDir, { recursive: true })
    logger = new TaskChatEventLog({ workspacePath: testDir })
  })

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("startSession", () => {
    it("creates a new session and log file", async () => {
      const sessionId = await logger.startSession()

      expect(sessionId).toMatch(/^[a-f0-9]{8}$/)
      expect(logger.isLogging).toBe(true)
      expect(logger.currentSessionId).toBe(sessionId)
      expect(logger.currentEventCount).toBe(0)

      // Verify logs directory was created
      const logsDir = join(testDir, ".beads", "task-chat-logs")
      const files = await readdir(logsDir)
      expect(files.length).toBe(0) // File only created when first event logged
    })

    it("throws if session already active", async () => {
      await logger.startSession()

      await expect(logger.startSession()).rejects.toThrow(
        "A logging session is already active. Call endSession() first.",
      )
    })
  })

  describe("log", () => {
    it("appends events to JSONL file", async () => {
      const sessionId = await logger.startSession()

      const event1: TaskChatEvent = { type: "chunk", timestamp: 1000 }
      const event2: TaskChatEvent = { type: "message", timestamp: 2000 }

      await logger.log(event1)
      await logger.log(event2)

      expect(logger.currentEventCount).toBe(2)

      // Read the log file directly
      const logsDir = join(testDir, ".beads", "task-chat-logs")
      const files = await readdir(logsDir)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(new RegExp(`^${sessionId}-.+\\.jsonl$`))

      const content = await readFile(join(logsDir, files[0]), "utf-8")
      const lines = content.trim().split("\n")
      expect(lines.length).toBe(2)

      const entry1: TaskChatLogEntry = JSON.parse(lines[0])
      expect(entry1.sessionId).toBe(sessionId)
      expect(entry1.event).toEqual(event1)
      expect(entry1.loggedAt).toBeDefined()

      const entry2: TaskChatLogEntry = JSON.parse(lines[1])
      expect(entry2.event).toEqual(event2)
    })

    it("throws if no session active", async () => {
      const event: TaskChatEvent = { type: "chunk", timestamp: 1000 }

      await expect(logger.log(event)).rejects.toThrow(
        "No logging session active. Call startSession() first.",
      )
    })
  })

  describe("endSession", () => {
    it("resets session state", async () => {
      await logger.startSession()
      const event: TaskChatEvent = { type: "chunk", timestamp: 1000 }
      await logger.log(event)

      logger.endSession()

      expect(logger.isLogging).toBe(false)
      expect(logger.currentSessionId).toBeNull()
      expect(logger.currentEventCount).toBe(0)
    })

    it("allows starting a new session after ending", async () => {
      const sessionId1 = await logger.startSession()
      logger.endSession()

      const sessionId2 = await logger.startSession()

      expect(sessionId2).not.toBe(sessionId1)
      expect(logger.isLogging).toBe(true)
    })
  })

  describe("listLogs", () => {
    it("returns empty array when no logs exist", async () => {
      const logs = await logger.listLogs()
      expect(logs).toEqual([])
    })

    it("lists all log files sorted by creation time", async () => {
      // Create two sessions with events
      const sessionId1 = await logger.startSession()
      await logger.log({ type: "chunk", timestamp: 1000 })
      logger.endSession()

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      const sessionId2 = await logger.startSession()
      await logger.log({ type: "message", timestamp: 2000 })
      logger.endSession()

      const logs = await logger.listLogs()

      expect(logs.length).toBe(2)
      // Newest first
      expect(logs[0].sessionId).toBe(sessionId2)
      expect(logs[1].sessionId).toBe(sessionId1)
      expect(logs[0].filename).toMatch(/\.jsonl$/)
      expect(logs[0].filePath).toContain(logs[0].filename)
    })

    it("handles malformed filenames gracefully", async () => {
      // Create logs directory and add a malformed file
      const logsDir = join(testDir, ".beads", "task-chat-logs")
      await mkdir(logsDir, { recursive: true })
      await writeFile(join(logsDir, "malformed-file.jsonl"), "{}\n")
      await writeFile(join(logsDir, "not-a-jsonl-file.txt"), "test")

      // Create a valid session
      await logger.startSession()
      await logger.log({ type: "chunk", timestamp: 1000 })
      logger.endSession()

      const logs = await logger.listLogs()

      // Should only include the valid log file
      expect(logs.length).toBe(1)
    })
  })

  describe("readLog", () => {
    it("reads all events from a log file", async () => {
      await logger.startSession()
      const events: TaskChatEvent[] = [
        { type: "chunk", timestamp: 1000 },
        { type: "message", timestamp: 2000, content: "Hello" },
        { type: "tool_use", timestamp: 3000, tool: "Read" },
      ]
      for (const event of events) {
        await logger.log(event)
      }
      logger.endSession()

      const logs = await logger.listLogs()
      const entries = await logger.readLog(logs[0].filePath)

      expect(entries.length).toBe(3)
      expect(entries[0].event).toEqual(events[0])
      expect(entries[1].event).toEqual(events[1])
      expect(entries[2].event).toEqual(events[2])
    })
  })

  describe("custom logsSubdir", () => {
    it("uses custom subdirectory", async () => {
      const customLogger = new TaskChatEventLog({
        workspacePath: testDir,
        logsSubdir: "my-custom-logs",
      })

      await customLogger.startSession()
      await customLogger.log({ type: "chunk", timestamp: 1000 })
      customLogger.endSession()

      // Verify the custom directory was used
      const customLogsDir = join(testDir, ".beads", "my-custom-logs")
      const files = await readdir(customLogsDir)
      expect(files.length).toBe(1)
    })
  })
})
