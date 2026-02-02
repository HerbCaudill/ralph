import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getAliveWorkspaces } from ".././getAliveWorkspaces.js"
import type { WorkspaceInfo } from ".././types.js"

vi.mock(".././getAvailableWorkspaces.js", () => ({
  getAvailableWorkspaces: vi.fn(),
}))

vi.mock(".././isProcessRunning.js", () => ({
  isProcessRunning: vi.fn(),
}))

import { getAvailableWorkspaces } from ".././getAvailableWorkspaces.js"
import { isProcessRunning } from ".././isProcessRunning.js"

const makeWorkspace = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  path: "/home/user/project",
  name: "project",
  database: "/home/user/project/.beads/beads.db",
  pid: 1000,
  version: "1.0.0",
  startedAt: "2025-01-01T00:00:00Z",
  isActive: false,
  ...overrides,
})

describe("getAliveWorkspaces", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns only workspaces with running processes", () => {
    const alive = makeWorkspace({ pid: 100, name: "alive" })
    const dead = makeWorkspace({ pid: 200, name: "dead" })

    vi.mocked(getAvailableWorkspaces).mockReturnValue([alive, dead])
    vi.mocked(isProcessRunning).mockImplementation(pid => pid === 100)

    const result = getAliveWorkspaces()

    expect(result).toEqual([alive])
  })

  it("returns empty array when no workspaces are alive", () => {
    vi.mocked(getAvailableWorkspaces).mockReturnValue([
      makeWorkspace({ pid: 300 }),
      makeWorkspace({ pid: 400 }),
    ])
    vi.mocked(isProcessRunning).mockReturnValue(false)

    const result = getAliveWorkspaces()

    expect(result).toEqual([])
  })

  it("returns all workspaces when all processes are alive", () => {
    const workspaces = [makeWorkspace({ pid: 500 }), makeWorkspace({ pid: 600 })]

    vi.mocked(getAvailableWorkspaces).mockReturnValue(workspaces)
    vi.mocked(isProcessRunning).mockReturnValue(true)

    const result = getAliveWorkspaces()

    expect(result).toEqual(workspaces)
  })

  it("passes currentPath through to getAvailableWorkspaces", () => {
    vi.mocked(getAvailableWorkspaces).mockReturnValue([])

    getAliveWorkspaces("/my/workspace")

    expect(getAvailableWorkspaces).toHaveBeenCalledWith("/my/workspace")
  })

  it("returns empty array when registry is empty", () => {
    vi.mocked(getAvailableWorkspaces).mockReturnValue([])

    const result = getAliveWorkspaces()

    expect(result).toEqual([])
    expect(isProcessRunning).not.toHaveBeenCalled()
  })
})
