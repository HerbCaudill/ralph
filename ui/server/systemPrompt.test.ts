import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import { loadSystemPrompt, loadTaskChatSkill, getTaskChatAllowedTools, getTaskChatModel } from "./systemPrompt.js"

describe("systemPrompt", () => {
  const testDir = path.join(import.meta.dirname, "__test_system_prompt__")
  const claudeDir = path.join(testDir, ".claude")
  const skillDir = path.join(claudeDir, "skills", "manage-tasks")
  const customSkillPath = path.join(skillDir, "SKILL.md")

  beforeEach(async () => {
    // Create test directory structure
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
  })

  describe("loadSystemPrompt", () => {
    it("loads customized skill from .claude/skills folder when it exists", async () => {
      const customContent = `---
name: manage-tasks
description: Custom task manager
model: haiku
allowed-tools:
  - Read
  - Bash
---

# Custom Task Manager

This is a custom skill.`

      await mkdir(skillDir, { recursive: true })
      await writeFile(customSkillPath, customContent)

      const result = loadSystemPrompt(testDir)
      expect(result).toContain("# Custom Task Manager")
      expect(result).toContain("This is a custom skill.")
      // Should not contain frontmatter
      expect(result).not.toContain("---")
      expect(result).not.toContain("name: manage-tasks")
    })

    it("loads default skill when no custom skill exists", () => {
      // No custom skill in testDir, should fall back to default
      const result = loadSystemPrompt(testDir)
      expect(result).toContain("task management assistant")
      expect(result).toContain("beads")
    })

    it("prefers custom skill over default", async () => {
      const customContent = `---
name: manage-tasks
---

# My Custom Skill`

      await mkdir(skillDir, { recursive: true })
      await writeFile(customSkillPath, customContent)

      const result = loadSystemPrompt(testDir)
      expect(result).toContain("# My Custom Skill")
      expect(result).not.toContain("task management assistant")
    })
  })

  describe("loadTaskChatSkill", () => {
    it("returns full skill result with metadata", async () => {
      const customContent = `---
name: manage-tasks
description: Test description
model: haiku
allowed-tools:
  - Read
  - Bash
  - Glob
---

# Skill Content`

      await mkdir(skillDir, { recursive: true })
      await writeFile(customSkillPath, customContent)

      const result = loadTaskChatSkill(testDir)

      expect(result.content).toContain("# Skill Content")
      expect(result.metadata.name).toBe("manage-tasks")
      expect(result.metadata.model).toBe("haiku")
      expect(result.isCustom).toBe(true)
      expect(result.path).toBe(customSkillPath)
    })

    it("returns isCustom=false when loading default skill", () => {
      const result = loadTaskChatSkill(testDir)

      expect(result.isCustom).toBe(false)
      expect(result.path).toContain("prompts")
      expect(result.path).toContain("manage-tasks")
    })
  })

  describe("getTaskChatAllowedTools", () => {
    it("returns allowed tools from skill metadata", async () => {
      const customContent = `---
name: manage-tasks
allowed-tools:
  - Read
  - Bash
  - CustomTool
---

Content`

      await mkdir(skillDir, { recursive: true })
      await writeFile(customSkillPath, customContent)

      const tools = getTaskChatAllowedTools(testDir)

      expect(tools).toContain("Read")
      expect(tools).toContain("Bash")
      expect(tools).toContain("CustomTool")
    })

    it("returns default tools when using bundled skill", () => {
      const tools = getTaskChatAllowedTools(testDir)

      // Default skill should have some tools defined
      expect(tools).toBeDefined()
      expect(Array.isArray(tools)).toBe(true)
    })
  })

  describe("getTaskChatModel", () => {
    it("returns model from skill metadata", async () => {
      const customContent = `---
name: manage-tasks
model: opus
---

Content`

      await mkdir(skillDir, { recursive: true })
      await writeFile(customSkillPath, customContent)

      const model = getTaskChatModel(testDir)
      expect(model).toBe("opus")
    })

    it("returns default model when using bundled skill", () => {
      const model = getTaskChatModel(testDir)
      // Default skill should specify sonnet
      expect(model).toBe("sonnet")
    })
  })
})
