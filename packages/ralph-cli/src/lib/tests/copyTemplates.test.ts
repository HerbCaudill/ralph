import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { copyTemplates } from "../copyTemplates.js"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEST_DIR = join(__dirname, "..", "..", "..", ".test-workspace", "copyTemplates-test")

describe("copyTemplates", () => {
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    // Clean up
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it("copies files from templates to destination", () => {
    const templatesDir = join(TEST_DIR, "templates")
    const destDir = join(TEST_DIR, "dest")

    // Create source template
    mkdirSync(templatesDir, { recursive: true })
    writeFileSync(join(templatesDir, "test.md"), "test content")

    const result = copyTemplates(templatesDir, destDir, [{ src: "test.md", dest: "test.md" }])

    expect(result.created).toEqual(["test.md"])
    expect(result.skipped).toEqual([])
    expect(result.errors).toEqual([])
    expect(readFileSync(join(destDir, "test.md"), "utf-8")).toBe("test content")
  })

  it("creates nested directories", () => {
    const templatesDir = join(TEST_DIR, "templates")
    const destDir = join(TEST_DIR, "dest")

    mkdirSync(join(templatesDir, "subdir"), { recursive: true })
    writeFileSync(join(templatesDir, "subdir", "nested.md"), "nested content")

    const result = copyTemplates(templatesDir, destDir, [
      { src: "subdir/nested.md", dest: "subdir/nested.md" },
    ])

    expect(result.created).toEqual(["subdir/nested.md"])
    expect(existsSync(join(destDir, "subdir", "nested.md"))).toBe(true)
  })

  it("skips files that already exist", () => {
    const templatesDir = join(TEST_DIR, "templates")
    const destDir = join(TEST_DIR, "dest")

    mkdirSync(templatesDir, { recursive: true })
    mkdirSync(destDir, { recursive: true })
    writeFileSync(join(templatesDir, "existing.md"), "new content")
    writeFileSync(join(destDir, "existing.md"), "original content")

    const result = copyTemplates(templatesDir, destDir, [
      { src: "existing.md", dest: "existing.md" },
    ])

    expect(result.created).toEqual([])
    expect(result.skipped).toEqual(["existing.md"])
    // Original content should be preserved
    expect(readFileSync(join(destDir, "existing.md"), "utf-8")).toBe("original content")
  })

  it("reports errors for missing template files", () => {
    const templatesDir = join(TEST_DIR, "templates")
    const destDir = join(TEST_DIR, "dest")

    mkdirSync(templatesDir, { recursive: true })
    // Don't create the source file

    const result = copyTemplates(templatesDir, destDir, [
      { src: "nonexistent.md", dest: "nonexistent.md" },
    ])

    expect(result.created).toEqual([])
    expect(result.skipped).toEqual([])
    expect(result.errors).toEqual(["Template not found: nonexistent.md"])
    expect(existsSync(join(destDir, "nonexistent.md"))).toBe(false)
  })

  describe("ralph init template paths - regression test for r-clf", () => {
    // This test validates that the templates InitRalph.tsx expects actually exist
    it("has all required templates in ralph-cli/templates", () => {
      const cliTemplatesDir = join(__dirname, "..", "..", "..", "templates")

      // These are the files InitRalph.tsx should copy
      const expectedFiles = [
        "workflow.prompt.md", // NOT workflow.md
        "skills/manage-tasks/SKILL.md",
      ]

      for (const file of expectedFiles) {
        const exists = existsSync(join(cliTemplatesDir, file))
        expect(exists, `Template should exist: ${file}`).toBe(true)
      }

      // These legacy files should NOT be expected
      const legacyFiles = [
        "workflow.md", // Replaced by workflow.prompt.md
        "agents/make-tests.md", // No longer exists
        "agents/write-docs.md", // No longer exists
        "agents/run-tests.md", // No longer exists
      ]

      for (const file of legacyFiles) {
        const exists = existsSync(join(cliTemplatesDir, file))
        expect(exists, `Legacy template should not exist: ${file}`).toBe(false)
      }
    })
  })
})
