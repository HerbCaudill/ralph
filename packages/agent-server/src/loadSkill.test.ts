import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { loadSkill, hasCustomSkill, getCustomSkillPath } from "./loadSkill.js"
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("loadSkill", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "loadskill-test-"))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("loads the bundled manage-tasks skill", () => {
    // Using a non-existent cwd ensures we fall back to the bundled default
    const result = loadSkill("manage-tasks", "/tmp/nonexistent-" + Date.now())
    expect(result.content).toBeTruthy()
    expect(result.metadata.name).toBeTruthy()
    expect(result.isCustom).toBe(false)
    expect(result.path).toContain("manage-tasks")
  })

  it("throws for non-existent skill", () => {
    expect(() => loadSkill("nonexistent-skill-" + Date.now())).toThrow("not found")
  })

  it("loads a custom skill from .claude/skills/", async () => {
    const skillDir = join(tempDir, ".claude", "skills", "test-skill")
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: Test Skill
description: A test skill
---
This is the test skill content.`,
    )

    const result = loadSkill("test-skill", tempDir)
    expect(result.isCustom).toBe(true)
    expect(result.content).toBe("This is the test skill content.")
    expect(result.metadata.name).toBe("Test Skill")
    expect(result.metadata.description).toBe("A test skill")
  })

  it("prefers custom skill over bundled default", async () => {
    const skillDir = join(tempDir, ".claude", "skills", "manage-tasks")
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: Custom Manage Tasks
---
Custom content.`,
    )

    const result = loadSkill("manage-tasks", tempDir)
    expect(result.isCustom).toBe(true)
    expect(result.content).toBe("Custom content.")
  })

  it("handles skill files without frontmatter", async () => {
    const skillDir = join(tempDir, ".claude", "skills", "plain-skill")
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, "SKILL.md"), "Just plain content without frontmatter.")

    const result = loadSkill("plain-skill", tempDir)
    expect(result.isCustom).toBe(true)
    expect(result.content).toBe("Just plain content without frontmatter.")
    expect(result.metadata.name).toBe("plain-skill") // falls back to skill name
  })
})

describe("hasCustomSkill", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "hascustomskill-test-"))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("returns false when no custom skill exists", () => {
    expect(hasCustomSkill("manage-tasks", tempDir)).toBe(false)
  })

  it("returns true when custom skill exists", async () => {
    const skillDir = join(tempDir, ".claude", "skills", "manage-tasks")
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, "SKILL.md"), "custom content")

    expect(hasCustomSkill("manage-tasks", tempDir)).toBe(true)
  })
})

describe("getCustomSkillPath", () => {
  it("returns the expected path", () => {
    const path = getCustomSkillPath("manage-tasks", "/tmp/project")
    expect(path).toBe("/tmp/project/.claude/skills/manage-tasks/SKILL.md")
  })
})
