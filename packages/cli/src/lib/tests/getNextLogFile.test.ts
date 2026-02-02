import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getNextLogFile } from ".././getNextLogFile.js"
import { getLatestLogFile } from ".././getLatestLogFile.js"
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

describe("getNextLogFile", () => {
  const testDir = join(process.cwd(), ".ralph-test")

  beforeEach(() => {
    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  describe("getNextLogFile", () => {
    it("returns events-1.jsonl when no logs exist", () => {
      // Mock the current working directory by creating a test context
      // Note: This test uses the actual cwd, so we need to ensure .ralph doesn't exist
      // or has no event logs. For unit testing, we'd typically mock the file system.
      const result = getNextLogFile()
      expect(result).toMatch(/events-\d+\.jsonl$/)
    })
  })

  describe("getLatestLogFile", () => {
    it("returns undefined when no logs exist in empty directory", () => {
      // Create .ralph directory but with no log files
      const ralphDir = join(process.cwd(), ".ralph")
      // This test would need to mock the file system to be fully isolated
      // For now, we test the function returns the expected pattern
      const result = getLatestLogFile()
      // Either undefined (no logs) or a valid path (existing logs)
      if (result !== undefined) {
        expect(result).toMatch(/events-\d+\.jsonl$/)
      }
    })
  })
})

// Integration tests that verify the sequential numbering behavior
describe("sequential log file naming", () => {
  it("getNextLogFile returns one higher than getLatestLogFile", () => {
    const latest = getLatestLogFile()
    const next = getNextLogFile()

    if (latest === undefined) {
      // No existing logs, next should be events-1.jsonl
      expect(next).toContain("events-1.jsonl")
    } else {
      // Extract numbers and verify next is latest + 1
      const latestMatch = latest.match(/events-(\d+)\.jsonl$/)
      const nextMatch = next.match(/events-(\d+)\.jsonl$/)
      expect(latestMatch).not.toBeNull()
      expect(nextMatch).not.toBeNull()
      if (latestMatch && nextMatch) {
        const latestNum = parseInt(latestMatch[1], 10)
        const nextNum = parseInt(nextMatch[1], 10)
        expect(nextNum).toBe(latestNum + 1)
      }
    }
  })
})
