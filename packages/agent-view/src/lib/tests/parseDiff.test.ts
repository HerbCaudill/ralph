import { describe, it, expect } from "vitest"
import { parseDiff } from ".././parseDiff"

describe("parseDiff", () => {
  describe("simple changes", () => {
    it("should detect single line replacement", () => {
      const oldStr = "line1\nold content\nline3"
      const newStr = "line1\nnew content\nline3"
      const result = parseDiff(oldStr, newStr)

      // Should have context, removed, added, and more context
      expect(result.some(r => r.type === "context")).toBe(true)
      expect(result.some(r => r.type === "removed")).toBe(true)
      expect(result.some(r => r.type === "added")).toBe(true)
    })

    it("should detect added content", () => {
      const oldStr = "line1\nline3"
      const newStr = "line1\nline2\nline3"
      const result = parseDiff(oldStr, newStr)

      expect(result.some(r => r.type === "added")).toBe(true)
      expect(result.filter(r => r.type === "added").length).toBeGreaterThanOrEqual(1)
    })

    it("should detect removed content", () => {
      const oldStr = "line1\nline2\nline3"
      const newStr = "line1\nline3"
      const result = parseDiff(oldStr, newStr)

      expect(result.some(r => r.type === "removed")).toBe(true)
    })
  })

  describe("context tracking", () => {
    it("should include context lines", () => {
      const oldStr = "ctx1\nctx2\noldline\nctx3\nctx4"
      const newStr = "ctx1\nctx2\nnewline\nctx3\nctx4"
      const result = parseDiff(oldStr, newStr)

      const contextLines = result.filter(r => r.type === "context")
      expect(contextLines.length).toBeGreaterThan(0)
    })

    it("should mark unchanged leading lines as context", () => {
      const oldStr = "same1\nsame2\nold\nafter"
      const newStr = "same1\nsame2\nnew\nafter"
      const result = parseDiff(oldStr, newStr)

      expect(result[0].type).toBe("context")
    })
  })

  describe("edge cases", () => {
    it("should handle identical strings", () => {
      const str = "line1\nline2"
      const result = parseDiff(str, str)

      expect(result.length).toBeGreaterThan(0)
      expect(result.every(r => r.type === "context")).toBe(true)
    })

    it("should handle empty old string", () => {
      const result = parseDiff("", "line1\nline2")

      // When old is empty, it treats it as one empty line that gets removed,
      // then all new lines get added
      expect(result.length).toBeGreaterThan(0)
      expect(result.some(r => r.type === "added")).toBe(true)
    })

    it("should handle empty new string", () => {
      const result = parseDiff("line1\nline2", "")

      // When new is empty, all old lines get removed, then one empty line gets added
      expect(result.length).toBeGreaterThan(0)
      expect(result.some(r => r.type === "removed")).toBe(true)
    })

    it("should handle both strings empty", () => {
      const result = parseDiff("", "")

      // Two empty strings produce a diff showing the empty line unchanged
      expect(result.length).toBeGreaterThan(0)
    })

    it("should handle single line strings", () => {
      const result = parseDiff("old", "new")

      expect(result).toContainEqual({ type: "removed", lineOld: 1, content: "old" })
      expect(result).toContainEqual({ type: "added", lineNew: 1, content: "new" })
    })
  })

  describe("line numbering", () => {
    it("should use 1-based line numbers", () => {
      const oldStr = "line1\nline2"
      const newStr = "line1\nmodified"
      const result = parseDiff(oldStr, newStr)

      const contextLine = result.find(r => r.type === "context")
      if (contextLine && "lineOld" in contextLine) {
        expect(contextLine.lineOld).toBeGreaterThan(0)
      }
      if (contextLine && "lineNew" in contextLine) {
        expect(contextLine.lineNew).toBeGreaterThan(0)
      }
    })

    it("should have line numbers for removed lines", () => {
      const oldStr = "a\nb\nc"
      const newStr = "a\nc"
      const result = parseDiff(oldStr, newStr)

      const removedLines = result.filter(r => r.type === "removed")
      expect(removedLines.every(r => "lineOld" in r && r.lineOld !== undefined)).toBe(true)
    })

    it("should have line numbers for added lines", () => {
      const oldStr = "a\nc"
      const newStr = "a\nb\nc"
      const result = parseDiff(oldStr, newStr)

      const addedLines = result.filter(r => r.type === "added")
      expect(addedLines.every(r => "lineNew" in r && r.lineNew !== undefined)).toBe(true)
    })
  })

  describe("multiple changes", () => {
    it("should handle multiple removed lines", () => {
      const oldStr = "line1\nremove1\nremove2\nline4"
      const newStr = "line1\nline4"
      const result = parseDiff(oldStr, newStr)

      const removedLines = result.filter(r => r.type === "removed")
      expect(removedLines.length).toBeGreaterThanOrEqual(2)
    })

    it("should handle multiple added lines", () => {
      const oldStr = "line1\nline4"
      const newStr = "line1\nadd1\nadd2\nline4"
      const result = parseDiff(oldStr, newStr)

      const addedLines = result.filter(r => r.type === "added")
      expect(addedLines.length).toBeGreaterThanOrEqual(2)
    })

    it("should produce valid diff structure", () => {
      const oldStr = "a\nb\nc\nd\ne"
      const newStr = "a\nx\ny\nd\ne"
      const result = parseDiff(oldStr, newStr)

      // Result should have at least some diff lines
      expect(result.length).toBeGreaterThan(0)
      // Should have both removed and added
      expect(result.some(r => r.type === "removed")).toBe(true)
      expect(result.some(r => r.type === "added")).toBe(true)
    })
  })
})
