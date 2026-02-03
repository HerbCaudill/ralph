import { describe, it, expect, vi, afterEach } from "vitest"
import { homedir, platform } from "node:os"
import { join } from "node:path"

// Mock os module before importing the function
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os")
  return {
    ...actual,
    homedir: vi.fn(() => "/home/testuser"),
    platform: vi.fn(() => "linux"),
  }
})

describe("getDefaultStorageDir", () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it("returns ~/.local/share/ralph/agent-sessions on Linux", async () => {
    vi.mocked(platform).mockReturnValue("linux")
    vi.mocked(homedir).mockReturnValue("/home/testuser")

    // Re-import to get fresh module with mocks
    const { getDefaultStorageDir } = await import("../getDefaultStorageDir.js")
    const result = getDefaultStorageDir()

    expect(result).toBe("/home/testuser/.local/share/ralph/agent-sessions")
  })

  it("returns ~/.local/share/ralph/agent-sessions on macOS", async () => {
    vi.mocked(platform).mockReturnValue("darwin")
    vi.mocked(homedir).mockReturnValue("/Users/testuser")

    const { getDefaultStorageDir } = await import("../getDefaultStorageDir.js")
    const result = getDefaultStorageDir()

    expect(result).toBe("/Users/testuser/.local/share/ralph/agent-sessions")
  })

  it("uses LOCALAPPDATA for storage on Windows", async () => {
    vi.mocked(platform).mockReturnValue("win32")
    vi.mocked(homedir).mockReturnValue("C:\\Users\\testuser")

    // Mock process.env.LOCALAPPDATA for Windows
    const originalLocalAppData = process.env.LOCALAPPDATA
    process.env.LOCALAPPDATA = "C:\\Users\\testuser\\AppData\\Local"

    try {
      const { getDefaultStorageDir } = await import("../getDefaultStorageDir.js")
      const result = getDefaultStorageDir()

      // On Windows, should use LOCALAPPDATA. Note: join() uses host OS separators,
      // so on macOS/Linux this will have forward slashes even when testing Windows paths.
      expect(result).toBe(join("C:\\Users\\testuser\\AppData\\Local", "ralph", "agent-sessions"))
    } finally {
      if (originalLocalAppData === undefined) {
        delete process.env.LOCALAPPDATA
      } else {
        process.env.LOCALAPPDATA = originalLocalAppData
      }
    }
  })

  it("returns a path that includes 'agent-sessions'", async () => {
    const { getDefaultStorageDir } = await import("../getDefaultStorageDir.js")
    const result = getDefaultStorageDir()

    expect(result).toContain("agent-sessions")
  })

  it("returns a path that includes 'ralph'", async () => {
    const { getDefaultStorageDir } = await import("../getDefaultStorageDir.js")
    const result = getDefaultStorageDir()

    expect(result).toContain("ralph")
  })
})
