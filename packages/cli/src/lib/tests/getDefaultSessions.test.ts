import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getDefaultSessions } from ".././getDefaultSessions.js"
import * as childProcess from "child_process"

vi.mock("child_process")

describe("getDefaultSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 120% of open issues (rounded up)", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify(Array(10).fill({ id: "x" })))
    expect(getDefaultSessions()).toBe(12) // 10 * 1.2 = 12
  })

  it("returns minimum of 10 when calculated value is lower", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify(Array(5).fill({ id: "x" })))
    expect(getDefaultSessions()).toBe(10) // 5 * 1.2 = 6, but min is 10
  })

  it("returns maximum of 100 when calculated value is higher", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify(Array(100).fill({ id: "x" })))
    expect(getDefaultSessions()).toBe(100) // 100 * 1.2 = 120, but max is 100
  })

  it("returns 10 when no open issues", () => {
    vi.mocked(childProcess.execSync).mockReturnValue("[]")
    expect(getDefaultSessions()).toBe(10)
  })

  it("returns 10 when bd command fails", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error("bd not found")
    })
    expect(getDefaultSessions()).toBe(10)
  })

  it("handles fractional calculations correctly", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(JSON.stringify(Array(15).fill({ id: "x" })))
    expect(getDefaultSessions()).toBe(18) // 15 * 1.2 = 18
  })
})
