import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  loadPrompt,
  initPrompt,
  getCustomPromptPath,
  hasCustomPrompt,
  type LoadPromptOptions,
} from "./loadPrompt.js"

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

  describe("getCustomPromptPath", () => {
    it("returns correct path for custom prompt", () => {
      const path = getCustomPromptPath({
        filename,
        customDir,
        cwd: testDir,
      })
      expect(path).toBe(join(testDir, customDir, filename))
    })

    it("uses process.cwd() when cwd is not provided", () => {
      const path = getCustomPromptPath({
        filename,
        customDir,
      })
      expect(path).toBe(join(process.cwd(), customDir, filename))
    })
  })

  describe("hasCustomPrompt", () => {
    it("returns false when custom prompt does not exist", () => {
      expect(
        hasCustomPrompt({
          filename,
          customDir,
          cwd: testDir,
        }),
      ).toBe(false)
    })

    it("returns true when custom prompt exists", () => {
      // Create custom prompt
      mkdirSync(join(testDir, customDir), { recursive: true })
      writeFileSync(join(testDir, customDir, filename), customPromptContent)

      expect(
        hasCustomPrompt({
          filename,
          customDir,
          cwd: testDir,
        }),
      ).toBe(true)
    })
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

  describe("initPrompt", () => {
    it("copies default to custom location when custom does not exist", () => {
      const result = initPrompt(createOptions())

      expect(result.created).toBe(true)
      expect(result.path).toBe(join(testDir, customDir, filename))
      expect(existsSync(result.path)).toBe(true)
    })

    it("creates custom directory if it does not exist", () => {
      expect(existsSync(join(testDir, customDir))).toBe(false)

      initPrompt(createOptions())

      expect(existsSync(join(testDir, customDir))).toBe(true)
    })

    it("does not overwrite existing custom prompt", () => {
      // Create custom prompt first
      mkdirSync(join(testDir, customDir), { recursive: true })
      writeFileSync(join(testDir, customDir, filename), customPromptContent)

      const result = initPrompt(createOptions())

      expect(result.created).toBe(false)
      expect(result.path).toBe(join(testDir, customDir, filename))
      // Content should still be the custom content, not overwritten with default
      const loaded = loadPrompt(createOptions())
      expect(loaded.content).toBe(customPromptContent)
    })

    it("throws error when default prompt does not exist", () => {
      // Remove default prompt
      rmSync(join(testDir, "defaults", filename))

      expect(() => initPrompt(createOptions())).toThrow(/Default prompt not found/)
    })

    it("creates nested directory structure if needed", () => {
      const nestedCustomDir = ".test-ralph/nested/dir"
      const options = createOptions({ customDir: nestedCustomDir })

      const result = initPrompt(options)

      expect(result.created).toBe(true)
      expect(existsSync(join(testDir, nestedCustomDir))).toBe(true)
    })
  })

  describe("integration", () => {
    it("init followed by load returns custom prompt", () => {
      // Initialize first
      const initResult = initPrompt(createOptions())
      expect(initResult.created).toBe(true)

      // Load should now return the custom prompt (copy of default)
      const loadResult = loadPrompt(createOptions())
      expect(loadResult.isCustom).toBe(true)
      expect(loadResult.content).toBe(defaultPromptContent)
    })

    it("hasCustomPrompt returns true after init", () => {
      expect(hasCustomPrompt({ filename, customDir, cwd: testDir })).toBe(false)

      initPrompt(createOptions())

      expect(hasCustomPrompt({ filename, customDir, cwd: testDir })).toBe(true)
    })
  })
})
