import { describe, it, expect } from "vitest"
import { stripTaskPrefix } from ".././stripTaskPrefix"

describe("stripTaskPrefix", () => {
  describe("when prefix is provided", () => {
    it("should strip matching prefix", () => {
      expect(stripTaskPrefix("rui-4vp", "rui")).toBe("4vp")
    })

    it("should handle task with subtask suffix", () => {
      expect(stripTaskPrefix("rui-4vp.5", "rui")).toBe("4vp.5")
    })

    it("should handle longer IDs", () => {
      expect(stripTaskPrefix("abc-def123", "abc")).toBe("def123")
    })

    it("should return full ID when prefix does not match", () => {
      expect(stripTaskPrefix("xyz-4vp", "rui")).toBe("xyz-4vp")
    })

    it("should handle case-sensitive matching", () => {
      expect(stripTaskPrefix("RUI-4vp", "rui")).toBe("RUI-4vp")
    })
  })

  describe("when prefix is null", () => {
    it("should return full task ID", () => {
      expect(stripTaskPrefix("rui-4vp", null)).toBe("rui-4vp")
    })

    it("should handle task with subtask", () => {
      expect(stripTaskPrefix("rui-4vp.5", null)).toBe("rui-4vp.5")
    })
  })

  describe("edge cases", () => {
    it("should handle empty task ID", () => {
      expect(stripTaskPrefix("", "rui")).toBe("")
    })

    it("should handle task ID that equals prefix only", () => {
      expect(stripTaskPrefix("rui-", "rui")).toBe("")
    })

    it("should not strip prefix without hyphen", () => {
      expect(stripTaskPrefix("rui4vp", "rui")).toBe("rui4vp")
    })
  })
})
