import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { loadPrompt, loadSessionPrompt, type LoadPromptOptions } from ".././loadPrompt.js"

describe("loadPrompt", () => {
  const testDir = join(tmpdir(), `loadPrompt-test-${Date.now()}`)
  const customDir = ".test-ralph"
  const filename = "test-prompt.md"
  const defaultPromptContent = "This is the default prompt content."
  const customPromptContent = "This is the custom prompt content."

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, "defaults"), { recursive: true })
    // Write default prompt
    writeFileSync(join(testDir, "defaults", filename), defaultPromptContent)
  })

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true })
  })

  const createOptions = (overrides: Partial<LoadPromptOptions> = {}): LoadPromptOptions => ({
    filename,
    customDir,
    defaultPath: join(testDir, "defaults", filename),
    cwd: testDir,
    ...overrides,
  })

  describe("loadPrompt", () => {
    it("loads from default path when no custom prompt exists", () => {
      const result = loadPrompt(createOptions())

      expect(result.content).toBe(defaultPromptContent)
      expect(result.path).toBe(join(testDir, "defaults", filename))
      expect(result.isCustom).toBe(false)
    })

    it("loads from custom path when custom prompt exists", () => {
      // Create custom prompt
      mkdirSync(join(testDir, customDir), { recursive: true })
      writeFileSync(join(testDir, customDir, filename), customPromptContent)

      const result = loadPrompt(createOptions())

      expect(result.content).toBe(customPromptContent)
      expect(result.path).toBe(join(testDir, customDir, filename))
      expect(result.isCustom).toBe(true)
    })

    it("prefers custom prompt over default", () => {
      // Create custom prompt
      mkdirSync(join(testDir, customDir), { recursive: true })
      writeFileSync(join(testDir, customDir, filename), customPromptContent)

      const result = loadPrompt(createOptions())

      expect(result.content).toBe(customPromptContent)
      expect(result.isCustom).toBe(true)
    })

    it("throws error when neither custom nor default exists", () => {
      // Remove default prompt
      rmSync(join(testDir, "defaults", filename))

      expect(() => loadPrompt(createOptions())).toThrow(/Prompt file not found/)
    })

    it("throws error with both paths mentioned", () => {
      // Remove default prompt
      rmSync(join(testDir, "defaults", filename))

      expect(() => loadPrompt(createOptions())).toThrow(
        new RegExp(join(testDir, customDir, filename).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      )
    })
  })

  describe("loadSessionPrompt", () => {
    it("loads workflow from the repo root when cwd is nested", () => {
      const repoRoot = join(testDir, "repo")
      const nested = join(repoRoot, "packages", "app")
      const templatesDir = join(testDir, "templates")
      mkdirSync(join(repoRoot, ".git"), { recursive: true })
      mkdirSync(nested, { recursive: true })
      mkdirSync(templatesDir, { recursive: true })

      writeFileSync(join(templatesDir, "core.prompt.md"), "CORE\\n\\n{WORKFLOW}")
      writeFileSync(join(templatesDir, "workflow.prompt.md"), "DEFAULT WORKFLOW")
      mkdirSync(join(repoRoot, ".ralph"), { recursive: true })
      writeFileSync(join(repoRoot, ".ralph", "workflow.prompt.md"), "CUSTOM WORKFLOW")

      const result = loadSessionPrompt({ templatesDir, cwd: nested })
      expect(result.content).toBe("CORE\\n\\nCUSTOM WORKFLOW")
      expect(result.hasCustomWorkflow).toBe(true)
      expect(result.workflowPath).toBe(join(repoRoot, ".ralph", "workflow.prompt.md"))
    })

    it("falls back to default workflow when no custom workflow exists", () => {
      const repoRoot = join(testDir, "repo-default")
      const nested = join(repoRoot, "packages", "app")
      const templatesDir = join(testDir, "templates-default")
      mkdirSync(join(repoRoot, ".git"), { recursive: true })
      mkdirSync(nested, { recursive: true })
      mkdirSync(templatesDir, { recursive: true })

      writeFileSync(join(templatesDir, "core.prompt.md"), "CORE\\n\\n{WORKFLOW}")
      writeFileSync(join(templatesDir, "workflow.prompt.md"), "DEFAULT WORKFLOW")

      const result = loadSessionPrompt({ templatesDir, cwd: nested })
      expect(result.content).toBe("CORE\\n\\nDEFAULT WORKFLOW")
      expect(result.hasCustomWorkflow).toBe(false)
      expect(result.workflowPath).toBe(join(templatesDir, "workflow.prompt.md"))
    })
  })
})
