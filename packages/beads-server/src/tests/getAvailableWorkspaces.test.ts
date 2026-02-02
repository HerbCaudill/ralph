import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getAvailableWorkspaces } from ".././getAvailableWorkspaces.js"

vi.mock(".././readRegistry.js", () => ({
  readRegistry: vi.fn(),
}))

import { readRegistry } from ".././readRegistry.js"

const ENTRIES = [
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

describe("getAvailableWorkspaces", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("maps registry entries to WorkspaceInfo objects", () => {
    vi.mocked(readRegistry).mockReturnValue(ENTRIES)

    const result = getAvailableWorkspaces()

    expect(result).toEqual([
      {
        path: "/home/user/project-a",
        name: "project-a",
        database: "/home/user/project-a/.beads/beads.db",
        pid: 12345,
        version: "1.0.0",
        startedAt: "2025-01-01T00:00:00Z",
        isActive: false,
      },
      {
        path: "/home/user/project-b",
        name: "project-b",
        database: "/home/user/project-b/.beads/beads.db",
        pid: 67890,
        version: "1.0.0",
        startedAt: "2025-01-02T00:00:00Z",
        isActive: false,
      },
    ])
  })

  it("marks the matching workspace as active when currentPath is provided", () => {
    vi.mocked(readRegistry).mockReturnValue(ENTRIES)

    const result = getAvailableWorkspaces("/home/user/project-b")

    expect(result[0].isActive).toBe(false)
    expect(result[1].isActive).toBe(true)
  })

  it("resolves paths when comparing currentPath", () => {
    vi.mocked(readRegistry).mockReturnValue(ENTRIES)

    // Trailing slash should still match via path.resolve
    const result = getAvailableWorkspaces("/home/user/project-a/")

    expect(result[0].isActive).toBe(true)
    expect(result[1].isActive).toBe(false)
  })

  it("sets all workspaces as inactive when currentPath does not match any", () => {
    vi.mocked(readRegistry).mockReturnValue(ENTRIES)

    const result = getAvailableWorkspaces("/home/user/other-project")

    expect(result.every(ws => ws.isActive === false)).toBe(true)
  })

  it("returns empty array when registry is empty", () => {
    vi.mocked(readRegistry).mockReturnValue([])

    const result = getAvailableWorkspaces()

    expect(result).toEqual([])
  })

  it("extracts name as basename of workspace path", () => {
    vi.mocked(readRegistry).mockReturnValue([
      {
        workspace_path: "/deeply/nested/path/my-project",
        socket_path: "/tmp/beads.sock",
        database_path: "/deeply/nested/path/my-project/.beads/beads.db",
        pid: 111,
        version: "2.0.0",
        started_at: "2025-06-01T00:00:00Z",
      },
    ])

    const result = getAvailableWorkspaces()

    expect(result[0].name).toBe("my-project")
  })

  it("sets isActive to false for all entries when no currentPath is provided", () => {
    vi.mocked(readRegistry).mockReturnValue(ENTRIES)

    const result = getAvailableWorkspaces()

    expect(result.every(ws => ws.isActive === false)).toBe(true)
  })
})
