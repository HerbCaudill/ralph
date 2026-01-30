import { describe, it, expect } from "vitest"
import { stripAnsi, hasAnsiCodes, cx, cn, stripTaskPrefix, toRelativePath } from "./utils"

describe("utils", () => {
  describe("stripAnsi", () => {
    it("should remove ANSI codes", () => {
      expect(stripAnsi("\x1b[31mRed\x1b[0m")).toBe("Red")
    })
  })

  describe("hasAnsiCodes", () => {
    it("should detect ANSI codes", () => {
      expect(hasAnsiCodes("\x1b[31mRed\x1b[0m")).toBe(true)
      expect(hasAnsiCodes("Plain text")).toBe(false)
    })
  })

  describe("cx and cn", () => {
    it("should combine class names", () => {
      const result = cx("text-red-500", "font-bold")
      expect(result).toBe("text-red-500 font-bold")
    })

    it("should handle conditional classes", () => {
      const result = cx("base", false && "conditional", "always")
      expect(result).toBe("base always")
    })

    it("should merge conflicting Tailwind classes", () => {
      const result = cx("p-4", "p-8")
      expect(result).toBe("p-8")
    })

    it("should work with cn alias", () => {
      const result = cn("text-blue-500", "font-semibold")
      expect(result).toBe("text-blue-500 font-semibold")
    })

    it("should handle arrays", () => {
      const result = cx(["text-red-500", "font-bold"])
      expect(result).toContain("text-red-500")
      expect(result).toContain("font-bold")
    })

    it("should handle objects", () => {
      const result = cx({
        "text-red-500": true,
        "font-bold": false,
        "underline": true,
      })
      expect(result).toContain("text-red-500")
      expect(result).not.toContain("font-bold")
      expect(result).toContain("underline")
    })
  })

  describe("stripTaskPrefix", () => {
    it("should strip matching prefix", () => {
      expect(stripTaskPrefix("rui-4vp", "rui")).toBe("4vp")
    })

    it("should return full ID when prefix is null", () => {
      expect(stripTaskPrefix("rui-4vp", null)).toBe("rui-4vp")
    })
  })

  describe("toRelativePath", () => {
    it("should convert to relative path", () => {
      const result = toRelativePath("/Users/test/project/src/file.ts", "/Users/test/project")
      expect(result).toBe("src/file.ts")
    })

    it("should return absolute path when workspace is null", () => {
      const path = "/Users/test/project/src/file.ts"
      expect(toRelativePath(path, null)).toBe(path)
    })
  })
})
