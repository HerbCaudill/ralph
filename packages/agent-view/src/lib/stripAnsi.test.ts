import { describe, it, expect } from "vitest"
import { stripAnsi, hasAnsiCodes } from "./stripAnsi"

describe("stripAnsi", () => {
  it("should remove ANSI color codes", () => {
    const input = "\x1b[31mRed text\x1b[0m"
    expect(stripAnsi(input)).toBe("Red text")
  })

  it("should remove multiple ANSI codes", () => {
    const input = "\x1b[1m\x1b[32mBold green\x1b[0m\x1b[0m"
    expect(stripAnsi(input)).toBe("Bold green")
  })

  it("should handle text without ANSI codes", () => {
    const input = "Plain text"
    expect(stripAnsi(input)).toBe("Plain text")
  })

  it("should handle empty string", () => {
    expect(stripAnsi("")).toBe("")
  })

  it("should remove complex ANSI sequences", () => {
    const input = "\x1b[38;5;214mOrange\x1b[0m"
    expect(stripAnsi(input)).toBe("Orange")
  })
})

describe("hasAnsiCodes", () => {
  it("should detect ANSI codes", () => {
    expect(hasAnsiCodes("\x1b[31mRed\x1b[0m")).toBe(true)
  })

  it("should return false for plain text", () => {
    expect(hasAnsiCodes("Plain text")).toBe(false)
  })

  it("should return false for empty string", () => {
    expect(hasAnsiCodes("")).toBe(false)
  })

  it("should detect partial ANSI escape sequence", () => {
    expect(hasAnsiCodes("Text with \x1b[")).toBe(true)
  })

  it("should detect ANSI code at start", () => {
    expect(hasAnsiCodes("\x1b[32mGreen")).toBe(true)
  })
})
