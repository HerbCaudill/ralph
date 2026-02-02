import { describe, it, expect } from "vitest"
import {
  loadSystemPrompt,
  loadTaskChatSkill,
  getTaskChatAllowedTools,
  getTaskChatModel,
} from ".././systemPrompt.js"

describe("systemPrompt", () => {
  // These tests use the bundled default skill, which should always exist.
  // They verify basic functionality without requiring a custom skill setup.

  describe("loadSystemPrompt", () => {
    it("can be imported and returns a non-empty string", () => {
      // Use a non-existent cwd so custom skill is not found, falling back to bundled
      const prompt = loadSystemPrompt("/tmp/nonexistent-" + Date.now())
      expect(typeof prompt).toBe("string")
      expect(prompt.length).toBeGreaterThan(0)
    })
  })

  describe("loadTaskChatSkill", () => {
    it("returns a LoadSkillResult with content and metadata", () => {
      const result = loadTaskChatSkill("/tmp/nonexistent-" + Date.now())
      expect(result).toHaveProperty("content")
      expect(result).toHaveProperty("metadata")
      expect(result).toHaveProperty("path")
      expect(result).toHaveProperty("isCustom")
      expect(result.isCustom).toBe(false)
      expect(typeof result.content).toBe("string")
      expect(result.content.length).toBeGreaterThan(0)
    })
  })

  describe("getTaskChatAllowedTools", () => {
    it("returns undefined or an array of strings", () => {
      const tools = getTaskChatAllowedTools("/tmp/nonexistent-" + Date.now())
      if (tools !== undefined) {
        expect(Array.isArray(tools)).toBe(true)
        for (const tool of tools) {
          expect(typeof tool).toBe("string")
        }
      }
    })
  })

  describe("getTaskChatModel", () => {
    it("returns undefined or a string", () => {
      const model = getTaskChatModel("/tmp/nonexistent-" + Date.now())
      if (model !== undefined) {
        expect(typeof model).toBe("string")
      }
    })
  })
})
