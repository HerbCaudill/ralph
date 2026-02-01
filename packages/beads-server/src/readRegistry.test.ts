import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import { readRegistry } from "./readRegistry.js"

vi.mock("node:fs")

// Mock getRegistryPath to return a predictable path
vi.mock("./getRegistryPath.js", () => ({
  getRegistryPath: () => "/mock/.beads/registry.json",
}))

describe("readRegistry", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns parsed entries from a valid registry file", () => {
    const entries = [
      {
        workspace_path: "/home/user/project-a",
        socket_path: "/tmp/beads-a.sock",
        database_path: "/home/user/project-a/.beads/beads.db",
        pid: 12345,
        version: "1.0.0",
        started_at: "2025-01-01T00:00:00Z",
      },
      {
        workspace_path: "/home/user/project-b",
        socket_path: "/tmp/beads-b.sock",
        database_path: "/home/user/project-b/.beads/beads.db",
        pid: 67890,
        version: "1.0.0",
        started_at: "2025-01-02T00:00:00Z",
      },
    ]

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(entries))

    const result = readRegistry()
    expect(result).toEqual(entries)
    expect(result).toHaveLength(2)
    expect(fs.readFileSync).toHaveBeenCalledWith("/mock/.beads/registry.json", "utf8")
  })

  it("returns empty array when registry file does not exist", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory")
    })

    const result = readRegistry()
    expect(result).toEqual([])
  })

  it("returns empty array when registry file contains invalid JSON", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("this is not valid json {{{")

    const result = readRegistry()
    expect(result).toEqual([])
  })

  it("returns empty array when registry file contains a non-array JSON value", () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"not": "an array"}')

    const result = readRegistry()
    expect(result).toEqual([])
  })

  it("returns empty array when registry file contains a JSON string", () => {
    vi.mocked(fs.readFileSync).mockReturnValue('"just a string"')

    const result = readRegistry()
    expect(result).toEqual([])
  })

  it("returns empty array when registry file contains null", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("null")

    const result = readRegistry()
    expect(result).toEqual([])
  })

  it("returns entries for a valid empty array", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("[]")

    const result = readRegistry()
    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })
})
