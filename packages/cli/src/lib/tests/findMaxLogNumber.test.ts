import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { findMaxLogNumber } from ".././findMaxLogNumber.js"
import * as fs from "fs"

vi.mock("fs")

describe("findMaxLogNumber", () => {
  const mockExistsSync = vi.mocked(fs.existsSync)
  const mockReaddirSync = vi.mocked(fs.readdirSync)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 0 when .ralph directory does not exist", () => {
    mockExistsSync.mockReturnValue(false)
    expect(findMaxLogNumber()).toBe(0)
  })

  it("returns 0 when .ralph directory is empty", () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([])
    expect(findMaxLogNumber()).toBe(0)
  })

  it("returns the highest event log number", () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(["events-1.jsonl", "events-5.jsonl", "events-3.jsonl"] as any)
    expect(findMaxLogNumber()).toBe(5)
  })

  it("ignores non-matching files", () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([
      "events-1.jsonl",
      "other.txt",
      "events.jsonl",
      "events-2.jsonl",
    ] as any)
    expect(findMaxLogNumber()).toBe(2)
  })
})
