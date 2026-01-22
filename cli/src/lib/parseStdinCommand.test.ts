import { describe, it, expect } from "vitest"
import { parseStdinCommand } from "./parseStdinCommand.js"

describe("parseStdinCommand", () => {
  describe("message command", () => {
    it("parses valid message command", () => {
      const result = parseStdinCommand('{"type": "message", "text": "hello world"}')
      expect(result).toEqual({ type: "message", text: "hello world" })
    })

    it("handles message with special characters", () => {
      const result = parseStdinCommand('{"type": "message", "text": "line1\\nline2"}')
      expect(result).toEqual({ type: "message", text: "line1\nline2" })
    })

    it("handles empty message text", () => {
      const result = parseStdinCommand('{"type": "message", "text": ""}')
      expect(result).toEqual({ type: "message", text: "" })
    })

    it("returns null for message without text field", () => {
      const result = parseStdinCommand('{"type": "message"}')
      expect(result).toBeNull()
    })

    it("returns null for message with non-string text", () => {
      const result = parseStdinCommand('{"type": "message", "text": 123}')
      expect(result).toBeNull()
    })
  })

  describe("stop command", () => {
    it("parses valid stop command", () => {
      const result = parseStdinCommand('{"type": "stop"}')
      expect(result).toEqual({ type: "stop" })
    })

    it("ignores extra fields on stop command", () => {
      const result = parseStdinCommand('{"type": "stop", "extra": "ignored"}')
      expect(result).toEqual({ type: "stop" })
    })
  })

  describe("pause command", () => {
    it("parses valid pause command", () => {
      const result = parseStdinCommand('{"type": "pause"}')
      expect(result).toEqual({ type: "pause" })
    })

    it("ignores extra fields on pause command", () => {
      const result = parseStdinCommand('{"type": "pause", "extra": "ignored"}')
      expect(result).toEqual({ type: "pause" })
    })
  })

  describe("resume command", () => {
    it("parses valid resume command", () => {
      const result = parseStdinCommand('{"type": "resume"}')
      expect(result).toEqual({ type: "resume" })
    })

    it("ignores extra fields on resume command", () => {
      const result = parseStdinCommand('{"type": "resume", "extra": "ignored"}')
      expect(result).toEqual({ type: "resume" })
    })
  })

  describe("invalid input", () => {
    it("returns null for empty string", () => {
      const result = parseStdinCommand("")
      expect(result).toBeNull()
    })

    it("returns null for whitespace only", () => {
      const result = parseStdinCommand("   \n\t  ")
      expect(result).toBeNull()
    })

    it("returns null for invalid JSON", () => {
      const result = parseStdinCommand("not json")
      expect(result).toBeNull()
    })

    it("returns null for array instead of object", () => {
      const result = parseStdinCommand('["type", "message"]')
      expect(result).toBeNull()
    })

    it("returns null for null", () => {
      const result = parseStdinCommand("null")
      expect(result).toBeNull()
    })

    it("returns null for primitive value", () => {
      const result = parseStdinCommand("123")
      expect(result).toBeNull()
    })

    it("returns null for unknown command type", () => {
      const result = parseStdinCommand('{"type": "unknown"}')
      expect(result).toBeNull()
    })
  })

  describe("whitespace handling", () => {
    it("trims leading/trailing whitespace", () => {
      const result = parseStdinCommand('  {"type": "stop"}  ')
      expect(result).toEqual({ type: "stop" })
    })
  })
})
