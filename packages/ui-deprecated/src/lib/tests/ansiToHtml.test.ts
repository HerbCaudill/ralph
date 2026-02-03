import { describe, it, expect } from "vitest"
import { ansiToHtml, stripAnsi, hasAnsiCodes } from ".././ansiToHtml"

describe("ansiToHtml", () => {
  describe("basic functionality", () => {
    it("should return plain text unchanged", () => {
      expect(ansiToHtml("hello world")).toBe("hello world")
    })

    it("should escape HTML characters", () => {
      expect(ansiToHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
      )
    })

    it("should handle empty string", () => {
      expect(ansiToHtml("")).toBe("")
    })
  })

  describe("standard colors (30-37, 90-97)", () => {
    it("should convert red foreground", () => {
      const input = "\x1b[31mred text\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain('style="color:#cd0000"')
      expect(result).toContain("red text")
    })

    it("should convert green foreground", () => {
      const input = "\x1b[32mgreen text\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain('style="color:#00cd00"')
      expect(result).toContain("green text")
    })

    it("should convert bright yellow", () => {
      const input = "\x1b[93mbright yellow\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain('style="color:#ffff00"')
    })

    it("should handle multiple colors in sequence", () => {
      const input = "\x1b[31mred\x1b[32mgreen\x1b[34mblue\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("color:#cd0000")
      expect(result).toContain("color:#00cd00")
      expect(result).toContain("color:#0000ee")
    })
  })

  describe("background colors (40-47, 100-107)", () => {
    it("should convert background colors", () => {
      const input = "\x1b[41mred background\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain('style="background-color:#cd0000"')
    })

    it("should combine foreground and background", () => {
      const input = "\x1b[31;44mred on blue\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("color:#cd0000")
      expect(result).toContain("background-color:#0000ee")
    })
  })

  describe("style attributes", () => {
    it("should handle bold", () => {
      const input = "\x1b[1mbold text\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("font-weight:bold")
    })

    it("should handle dim", () => {
      const input = "\x1b[2mdim text\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("opacity:0.5")
    })

    it("should handle italic", () => {
      const input = "\x1b[3mitalic text\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("font-style:italic")
    })

    it("should handle underline", () => {
      const input = "\x1b[4munderlined text\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("text-decoration:underline")
    })

    it("should combine multiple styles", () => {
      const input = "\x1b[1;31;4mbold red underlined\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("font-weight:bold")
      expect(result).toContain("color:#cd0000")
      expect(result).toContain("text-decoration:underline")
    })
  })

  describe("256-color mode", () => {
    it("should handle 256-color foreground", () => {
      const input = "\x1b[38;5;196mcolor 196\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain('style="color:#')
      expect(result).toContain("color 196")
    })

    it("should handle 256-color background", () => {
      const input = "\x1b[48;5;21mbg 21\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("background-color:#")
    })

    it("should handle grayscale colors (232-255)", () => {
      const input = "\x1b[38;5;240mgray\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain('style="color:#')
    })
  })

  describe("true color (24-bit)", () => {
    it("should handle RGB foreground", () => {
      const input = "\x1b[38;2;255;128;64mtrue color\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("color:rgb(255,128,64)")
    })

    it("should handle RGB background", () => {
      const input = "\x1b[48;2;0;100;200mrgb bg\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("background-color:rgb(0,100,200)")
    })
  })

  describe("reset handling", () => {
    it("should reset all styles with \\x1b[0m", () => {
      const input = "\x1b[1;31mbold red\x1b[0m normal"
      const result = ansiToHtml(input)
      expect(result).toContain("bold red")
      expect(result).toContain("normal")
      // The "normal" text should not have any styling
      expect(result).not.toMatch(/<span[^>]*>normal<\/span>/)
    })

    it("should handle empty reset \\x1b[m", () => {
      const input = "\x1b[31mred\x1b[m normal"
      const result = ansiToHtml(input)
      expect(result).toContain("red")
      expect(result).toContain("normal")
    })
  })

  describe("real-world terminal output", () => {
    it("should handle git status output", () => {
      const input = "\x1b[32m+ added line\x1b[0m\n\x1b[31m- removed line\x1b[0m"
      const result = ansiToHtml(input)
      expect(result).toContain("color:#00cd00")
      expect(result).toContain("color:#cd0000")
      expect(result).toContain("+ added line")
      expect(result).toContain("- removed line")
    })

    it("should handle vitest output with check marks", () => {
      const input = "\x1b[32m✓\x1b[39m test passed"
      const result = ansiToHtml(input)
      expect(result).toContain("color:#00cd00")
    })

    it("should preserve newlines and spaces", () => {
      const input = "line1\n  indented\n\ttabbed"
      const result = ansiToHtml(input)
      expect(result).toBe("line1\n  indented\n\ttabbed")
    })
  })
})

describe("stripAnsi", () => {
  it("should strip all ANSI codes", () => {
    const input = "\x1b[31mred\x1b[0m \x1b[1;32mbold green\x1b[0m"
    expect(stripAnsi(input)).toBe("red bold green")
  })

  it("should return plain text unchanged", () => {
    expect(stripAnsi("no colors")).toBe("no colors")
  })

  it("should handle empty string", () => {
    expect(stripAnsi("")).toBe("")
  })
})

describe("hasAnsiCodes", () => {
  it("should return true for strings with ANSI codes", () => {
    expect(hasAnsiCodes("\x1b[31mred\x1b[0m")).toBe(true)
  })

  it("should return false for plain text", () => {
    expect(hasAnsiCodes("no colors")).toBe(false)
  })

  it("should return false for empty string", () => {
    expect(hasAnsiCodes("")).toBe(false)
  })
})
