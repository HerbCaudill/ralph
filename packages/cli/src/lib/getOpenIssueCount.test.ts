import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getOpenIssueCount } from "./getOpenIssueCount.js"
import * as childProcess from "child_process"

vi.mock("child_process")

describe("getOpenIssueCount", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the count of open issues", () => {
    vi.mocked(childProcess.execSync).mockReturnValue(
      JSON.stringify([{ id: "1" }, { id: "2" }, { id: "3" }]),
    )
    expect(getOpenIssueCount()).toBe(3)
  })

  it("returns 0 when bd command fails", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error("bd not found")
    })
    expect(getOpenIssueCount()).toBe(0)
  })

  it("returns 0 when output is invalid JSON", () => {
    vi.mocked(childProcess.execSync).mockReturnValue("not json")
    expect(getOpenIssueCount()).toBe(0)
  })

  it("returns 0 when output is not an array", () => {
    vi.mocked(childProcess.execSync).mockReturnValue('{"error": "something"}')
    expect(getOpenIssueCount()).toBe(0)
  })
})
