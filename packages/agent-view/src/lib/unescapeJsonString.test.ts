import { describe, it, expect } from "vitest"
import { unescapeJsonString } from "./unescapeJsonString"

describe("unescapeJsonString", () => {
  it("should unescape newline character", () => {
    expect(unescapeJsonString("line1\\nline2")).toBe("line1\nline2")
  })

  it("should unescape tab character", () => {
    expect(unescapeJsonString("col1\\tcol2")).toBe("col1\tcol2")
  })

  it("should unescape carriage return", () => {
    expect(unescapeJsonString("text\\rmore")).toBe("text\rmore")
  })

  it("should unescape backslash", () => {
    expect(unescapeJsonString("path\\\\to\\\\file")).toBe("path\\to\\file")
  })

  it("should unescape quote", () => {
    expect(unescapeJsonString('say \\"hello\\"')).toBe('say "hello"')
  })

  it("should handle multiple escape sequences", () => {
    expect(unescapeJsonString("line1\\nline2\\tindented")).toBe("line1\nline2\tindented")
  })

  it("should handle text without escapes", () => {
    expect(unescapeJsonString("plain text")).toBe("plain text")
  })

  it("should handle empty string", () => {
    expect(unescapeJsonString("")).toBe("")
  })

  it("should handle consecutive escapes", () => {
    expect(unescapeJsonString("\\n\\n\\n")).toBe("\n\n\n")
  })

  it("should preserve unknown escape sequences", () => {
    expect(unescapeJsonString("\\x")).toBe("x")
  })
})
