import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fs from "node:fs"
import * as os from "node:os"
import {
  loadContextFile,
  loadContextFileSync,
  getContextFilename,
  type AdapterType,
} from "../loadContextFile.js"

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

describe("loadContextFile", () => {
  const mockExistsSync = vi.mocked(fs.existsSync)
  const mockReadFileSync = vi.mocked(fs.readFileSync)
  const mockHomedir = vi.mocked(os.homedir)

  beforeEach(() => {
    vi.clearAllMocks()
    mockHomedir.mockReturnValue("/home/testuser")
  })

  describe("getContextFilename", () => {
    it("returns CLAUDE.md for claude adapter", () => {
      expect(getContextFilename("claude")).toBe("CLAUDE.md")
    })

    it("returns AGENTS.md for codex adapter", () => {
      expect(getContextFilename("codex")).toBe("AGENTS.md")
    })

    it("returns CLAUDE.md as default for unknown adapters", () => {
      expect(getContextFilename("unknown" as AdapterType)).toBe("CLAUDE.md")
    })
  })

  describe("loadContextFileSync", () => {
    it("loads CLAUDE.md for claude adapter", () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/project/CLAUDE.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/project/CLAUDE.md") return "# Claude Config"
        throw new Error(`File not found: ${p}`)
      })

      const result = loadContextFileSync({ cwd: "/project", adapter: "claude" })
      expect(result).toBe("# Claude Config")
    })

    it("loads AGENTS.md for codex adapter", () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/project/AGENTS.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/project/AGENTS.md") return "# Codex Config"
        throw new Error(`File not found: ${p}`)
      })

      const result = loadContextFileSync({ cwd: "/project", adapter: "codex" })
      expect(result).toBe("# Codex Config")
    })

    it("returns null when context file does not exist", () => {
      mockExistsSync.mockReturnValue(false)

      const result = loadContextFileSync({ cwd: "/project", adapter: "claude" })
      expect(result).toBeNull()
    })

    it("combines global and workspace context files for claude", () => {
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

      const result = loadContextFileSync({ cwd: "/project", adapter: "claude" })
      expect(result).toBe("# Global Config\n\n# Workspace Config")
    })

    it("combines global and workspace context files for codex", () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/home/testuser/.codex/AGENTS.md" || p === "/project/AGENTS.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/home/testuser/.codex/AGENTS.md") return "# Global Codex"
        if (p === "/project/AGENTS.md") return "# Workspace Codex"
        throw new Error(`File not found: ${p}`)
      })

      const result = loadContextFileSync({ cwd: "/project", adapter: "codex" })
      expect(result).toBe("# Global Codex\n\n# Workspace Codex")
    })

    it("uses process.cwd() when no cwd is provided", () => {
      const originalCwd = process.cwd()
      mockExistsSync.mockReturnValue(false)

      loadContextFileSync({ adapter: "claude" })

      // Should check for workspace context file at process.cwd()
      expect(mockExistsSync).toHaveBeenCalledWith(`${originalCwd}/CLAUDE.md`)
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

      const result = loadContextFileSync({ cwd: "/project", adapter: "claude" })
      expect(result).toBe("# Config")
    })

    it("returns null when files exist but are empty", () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue("   \n  ")

      const result = loadContextFileSync({ cwd: "/project", adapter: "claude" })
      expect(result).toBeNull()
    })
  })

  describe("loadContextFile (async)", () => {
    it("returns null when no context files exist", async () => {
      mockExistsSync.mockReturnValue(false)

      const result = await loadContextFile({ cwd: "/project", adapter: "claude" })
      expect(result).toBeNull()
    })

    it("loads adapter-specific context files", async () => {
      mockExistsSync.mockImplementation((filePath: fs.PathLike) => {
        const p = String(filePath)
        return p === "/project/AGENTS.md"
      })
      mockReadFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor) => {
        const p = String(filePath)
        if (p === "/project/AGENTS.md") return "# Codex Workspace"
        throw new Error(`File not found: ${p}`)
      })

      const result = await loadContextFile({ cwd: "/project", adapter: "codex" })
      expect(result).toBe("# Codex Workspace")
    })
  })
})
