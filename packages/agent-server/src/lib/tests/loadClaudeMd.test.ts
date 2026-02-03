import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { loadClaudeMd, loadClaudeMdSync, CLAUDE_MD_FILENAME } from "../loadClaudeMd.js"

// Mock the fs module
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

// Mock os.homedir
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os")
  return {
    ...actual,
    homedir: vi.fn(() => "/home/testuser"),
  }
})

describe("loadClaudeMd", () => {
  const mockExistsSync = vi.mocked(fs.existsSync)
  const mockReadFileSync = vi.mocked(fs.readFileSync)
  const mockHomedir = vi.mocked(os.homedir)

  beforeEach(() => {
    vi.clearAllMocks()
    mockHomedir.mockReturnValue("/home/testuser")
  })

  describe("CLAUDE_MD_FILENAME constant", () => {
    it("is CLAUDE.md", () => {
      expect(CLAUDE_MD_FILENAME).toBe("CLAUDE.md")
    })
  })

  describe("loadClaudeMdSync", () => {
    it("returns null when no CLAUDE.md files exist", () => {
      mockExistsSync.mockReturnValue(false)

      const result = loadClaudeMdSync({ cwd: "/project" })
      expect(result).toBeNull()
    })

    it("returns workspace CLAUDE.md content when only workspace file exists", () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/project/CLAUDE.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/project/CLAUDE.md") return "# Workspace Config"
        throw new Error(`File not found: ${p}`)
      })

      const result = loadClaudeMdSync({ cwd: "/project" })
      expect(result).toBe("# Workspace Config")
    })

    it("returns user global CLAUDE.md content when only global file exists", () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/home/testuser/.claude/CLAUDE.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/home/testuser/.claude/CLAUDE.md") return "# Global Config"
        throw new Error(`File not found: ${p}`)
      })

      const result = loadClaudeMdSync({ cwd: "/project" })
      expect(result).toBe("# Global Config")
    })

    it("returns combined content (global then workspace) when both files exist", () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/home/testuser/.claude/CLAUDE.md" || p === "/project/CLAUDE.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/home/testuser/.claude/CLAUDE.md") return "# Global Config"
        if (p === "/project/CLAUDE.md") return "# Workspace Config"
        throw new Error(`File not found: ${p}`)
      })

      const result = loadClaudeMdSync({ cwd: "/project" })
      // Order: global first, then workspace
      expect(result).toBe("# Global Config\n\n# Workspace Config")
    })

    it("uses process.cwd() when no cwd is provided", () => {
      const originalCwd = process.cwd()
      mockExistsSync.mockReturnValue(false)

      loadClaudeMdSync()

      // Should check for workspace CLAUDE.md at process.cwd()
      expect(mockExistsSync).toHaveBeenCalledWith(path.join(originalCwd, "CLAUDE.md"))
    })

    it("handles file read errors gracefully by returning null for that file", () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockImplementation(() => {
        throw new Error("Permission denied")
      })

      const result = loadClaudeMdSync({ cwd: "/project" })
      expect(result).toBeNull()
    })

    it("trims whitespace from content", () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/project/CLAUDE.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/project/CLAUDE.md") return "  \n# Config\n  "
        throw new Error(`File not found: ${p}`)
      })

      const result = loadClaudeMdSync({ cwd: "/project" })
      expect(result).toBe("# Config")
    })

    it("returns null when files exist but are empty", () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue("   \n  ")

      const result = loadClaudeMdSync({ cwd: "/project" })
      expect(result).toBeNull()
    })
  })

  describe("loadClaudeMd (async)", () => {
    it("returns null when no CLAUDE.md files exist", async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await loadClaudeMd({ cwd: "/project" })
      expect(result).toBeNull()
    })

    it("returns combined content when both files exist", async () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/home/testuser/.claude/CLAUDE.md" || p === "/project/CLAUDE.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/home/testuser/.claude/CLAUDE.md") return "# Global"
        if (p === "/project/CLAUDE.md") return "# Workspace"
        throw new Error(`File not found: ${p}`)
      })

      const result = await loadClaudeMd({ cwd: "/project" })
      expect(result).toBe("# Global\n\n# Workspace")
    })
  })
})
