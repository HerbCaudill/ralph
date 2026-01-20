import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, writeFile, rm, readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import {
  loadSystemPrompt,
  initSystemPrompt,
  getCustomPromptPath,
  getDefaultPromptPath,
} from "./systemPrompt.js"

describe("systemPrompt", () => {
  const testDir = path.join(import.meta.dirname, "__test_system_prompt__")
  const ralphDir = path.join(testDir, ".ralph")
  const customPromptPath = path.join(ralphDir, "task-chat-system.md")

  beforeEach(async () => {
    // Create test directory structure
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
  })

  describe("getCustomPromptPath", () => {
    it("returns path to .ralph/task-chat-system.md", () => {
      const result = getCustomPromptPath(testDir)
      expect(result).toBe(customPromptPath)
    })

    it("uses process.cwd() when no argument provided", () => {
      const result = getCustomPromptPath()
      expect(result).toBe(path.join(process.cwd(), ".ralph", "task-chat-system.md"))
    })
  })

  describe("getDefaultPromptPath", () => {
    it("returns path to server/prompts/task-chat-system.md", () => {
      const result = getDefaultPromptPath()
      expect(result).toContain("server")
      expect(result).toContain("prompts")
      expect(result).toContain("task-chat-system.md")
    })

    it("points to an existing file", () => {
      const result = getDefaultPromptPath()
      expect(existsSync(result)).toBe(true)
    })
  })

  describe("loadSystemPrompt", () => {
    it("loads customized prompt from .ralph folder when it exists", async () => {
      const customContent = "# Custom System Prompt\n\nThis is a custom prompt."
      await mkdir(ralphDir, { recursive: true })
      await writeFile(customPromptPath, customContent)

      const result = loadSystemPrompt(testDir)
      expect(result).toBe(customContent)
    })

    it("loads default prompt when no custom prompt exists", () => {
      // No custom prompt in testDir, should fall back to default
      const result = loadSystemPrompt(testDir)
      expect(result).toContain("task management assistant")
      expect(result).toContain("beads")
    })

    it("prefers custom prompt over default", async () => {
      const customContent = "# My Custom Prompt"
      await mkdir(ralphDir, { recursive: true })
      await writeFile(customPromptPath, customContent)

      const result = loadSystemPrompt(testDir)
      expect(result).toBe(customContent)
      expect(result).not.toContain("Task Management Assistant")
    })
  })

  describe("initSystemPrompt", () => {
    it("creates .ralph directory and copies default prompt", async () => {
      expect(existsSync(ralphDir)).toBe(false)

      const result = initSystemPrompt(testDir)

      expect(result.created).toBe(true)
      expect(result.path).toBe(customPromptPath)
      expect(existsSync(customPromptPath)).toBe(true)

      // Verify content matches default
      const content = await readFile(customPromptPath, "utf-8")
      expect(content).toContain("task management assistant")
    })

    it("does not overwrite existing custom prompt", async () => {
      const customContent = "# My Existing Custom Prompt"
      await mkdir(ralphDir, { recursive: true })
      await writeFile(customPromptPath, customContent)

      const result = initSystemPrompt(testDir)

      expect(result.created).toBe(false)
      expect(result.path).toBe(customPromptPath)

      // Verify content was not overwritten
      const content = await readFile(customPromptPath, "utf-8")
      expect(content).toBe(customContent)
    })

    it("creates .ralph directory when it does not exist", async () => {
      expect(existsSync(ralphDir)).toBe(false)

      initSystemPrompt(testDir)

      expect(existsSync(ralphDir)).toBe(true)
    })

    it("works when .ralph directory already exists", async () => {
      await mkdir(ralphDir, { recursive: true })
      expect(existsSync(ralphDir)).toBe(true)

      const result = initSystemPrompt(testDir)

      expect(result.created).toBe(true)
      expect(existsSync(customPromptPath)).toBe(true)
    })
  })
})
