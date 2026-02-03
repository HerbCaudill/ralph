import { describe, it, expect, vi, beforeEach } from "vitest"
import { assemblePrompt, type AssemblePromptOptions } from "../loadPrompt.js"
import * as loadContextFile from "../loadContextFile.js"

// Mock loadContextFile module
vi.mock("../loadContextFile.js", async () => {
  return {
    loadContextFileSync: vi.fn(),
  }
})

describe("loadPrompt", () => {
  const mockLoadContextFileSync = vi.mocked(loadContextFile.loadContextFileSync)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("assemblePrompt", () => {
    it("returns empty string when no components are provided", () => {
      mockLoadContextFileSync.mockReturnValue(null)

      const result = assemblePrompt({
        cwd: "/project",
        adapter: "claude",
      })

      expect(result).toBe("")
    })

    it("returns only context file content when no system prompt is provided", () => {
      mockLoadContextFileSync.mockReturnValue("# Context from CLAUDE.md")

      const result = assemblePrompt({
        cwd: "/project",
        adapter: "claude",
      })

      expect(result).toBe("# Context from CLAUDE.md")
    })

    it("returns only system prompt when no context file exists", () => {
      mockLoadContextFileSync.mockReturnValue(null)

      const result = assemblePrompt({
        cwd: "/project",
        adapter: "claude",
        systemPrompt: "You are a helpful assistant.",
      })

      expect(result).toBe("You are a helpful assistant.")
    })

    it("combines context file and system prompt with correct order", () => {
      mockLoadContextFileSync.mockReturnValue("# Context from CLAUDE.md")

      const result = assemblePrompt({
        cwd: "/project",
        adapter: "claude",
        systemPrompt: "You are a helpful assistant.",
      })

      // Context file comes first, then system prompt
      expect(result).toBe("# Context from CLAUDE.md\n\nYou are a helpful assistant.")
    })

    it("includes working directory context when cwd is provided", () => {
      mockLoadContextFileSync.mockReturnValue(null)

      const result = assemblePrompt({
        cwd: "/project/my-app",
        adapter: "claude",
        includeWorkingDirectoryContext: true,
      })

      expect(result).toContain("Working directory: /project/my-app")
      expect(result).toContain("IMPORTANT")
    })

    it("assembles all components in correct order: context file, cwd context, system prompt", () => {
      mockLoadContextFileSync.mockReturnValue("# Context file content")

      const result = assemblePrompt({
        cwd: "/project",
        adapter: "claude",
        systemPrompt: "Custom instructions",
        includeWorkingDirectoryContext: true,
      })

      // Verify order by checking positions
      const contextPos = result.indexOf("# Context file content")
      const cwdPos = result.indexOf("Working directory:")
      const systemPromptPos = result.indexOf("Custom instructions")

      expect(contextPos).toBeLessThan(cwdPos)
      expect(cwdPos).toBeLessThan(systemPromptPos)
    })

    it("passes correct adapter to loadContextFileSync", () => {
      mockLoadContextFileSync.mockReturnValue(null)

      assemblePrompt({
        cwd: "/project",
        adapter: "codex",
      })

      expect(mockLoadContextFileSync).toHaveBeenCalledWith({
        cwd: "/project",
        adapter: "codex",
      })
    })

    it("handles undefined adapter by defaulting to claude", () => {
      mockLoadContextFileSync.mockReturnValue(null)

      assemblePrompt({
        cwd: "/project",
      })

      expect(mockLoadContextFileSync).toHaveBeenCalledWith({
        cwd: "/project",
        adapter: "claude",
      })
    })

    it("trims the final assembled prompt", () => {
      mockLoadContextFileSync.mockReturnValue("  # Context  ")

      const result = assemblePrompt({
        cwd: "/project",
        adapter: "claude",
        systemPrompt: "  Instructions  ",
      })

      expect(result).not.toMatch(/^\s/)
      expect(result).not.toMatch(/\s$/)
    })
  })
})
