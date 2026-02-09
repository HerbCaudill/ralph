import { describe, it, expect } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { TEMPLATES_DIR } from "../templatesDir.js"

describe("manage-tasks prompt template", () => {
  const manageTasksPath = join(TEMPLATES_DIR, "manage-tasks.prompt.md")

  it("exists in the shared templates directory", () => {
    expect(existsSync(manageTasksPath)).toBe(true)
  })

  it("contains required sections", () => {
    const content = readFileSync(manageTasksPath, "utf-8")

    // Must identify as task management assistant
    expect(content).toContain("task management assistant")

    // Must contain the critical constraint about not coding
    expect(content).toContain("You are NOT a coding agent")

    // Must contain the beads reference section
    expect(content).toContain("bd ready")
    expect(content).toContain("bd create")
    expect(content).toContain("bd close")

    // Must contain examples showing correct/wrong behavior
    expect(content).toMatch(/wrong/i)
    expect(content).toMatch(/right/i)
  })

  it("does not have YAML frontmatter (since it will be used as raw content)", () => {
    const content = readFileSync(manageTasksPath, "utf-8")

    // The CLI template has frontmatter but for the shared template used in UI,
    // we strip the frontmatter since it's imported raw and used directly
    expect(content.trim().startsWith("---")).toBe(false)
  })
})
