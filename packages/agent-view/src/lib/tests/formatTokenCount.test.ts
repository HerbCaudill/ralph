import { describe, it, expect } from "vitest"
import { formatTokenCount } from ".././formatTokenCount"

describe("formatTokenCount", () => {
  describe("when count is in millions", () => {
    it("should format with M suffix", () => {
      expect(formatTokenCount(1_000_000)).toBe("1.0M")
    })

    it("should format with one decimal place", () => {
      expect(formatTokenCount(1_234_567)).toBe("1.2M")
    })

    it("should round to one decimal using toFixed", () => {
      // toFixed rounds to nearest, so 1.95M becomes 1.9M (not 2.0M)
      expect(formatTokenCount(1_950_000)).toBe("1.9M")
    })
  })

  describe("when count is in thousands", () => {
    it("should format with k suffix", () => {
      expect(formatTokenCount(1_000)).toBe("1.0k")
    })

    it("should format with one decimal place", () => {
      expect(formatTokenCount(1_234)).toBe("1.2k")
    })

    it("should round to one decimal", () => {
      expect(formatTokenCount(9_999)).toBe("10.0k")
    })
  })

  describe("when count is less than 1000", () => {
    it("should return exact count as string", () => {
      expect(formatTokenCount(999)).toBe("999")
    })

    it("should handle zero", () => {
      expect(formatTokenCount(0)).toBe("0")
    })

    it("should handle single digit", () => {
      expect(formatTokenCount(5)).toBe("5")
    })
  })

  describe("edge cases", () => {
    it("should handle boundary at 1000", () => {
      expect(formatTokenCount(1_000)).toBe("1.0k")
    })

    it("should handle boundary at 1,000,000", () => {
      expect(formatTokenCount(1_000_000)).toBe("1.0M")
    })

    it("should handle large numbers", () => {
      expect(formatTokenCount(123_456_789)).toBe("123.5M")
    })
  })
})
