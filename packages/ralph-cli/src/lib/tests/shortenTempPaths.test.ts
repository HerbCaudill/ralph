import { describe, it, expect } from "vitest"
import { shortenTempPaths } from ".././shortenTempPaths.js"

describe("shortenTempPaths", () => {
  it("shortens /var/folders/ paths to just filename", () => {
    const text = "Reading file /var/folders/xy/abc123/T/temp-file.txt"
    const result = shortenTempPaths(text)
    expect(result).toBe("Reading file temp-file.txt")
  })

  it("shortens /tmp/ paths to just filename", () => {
    const text = "Writing to /tmp/output.json"
    const result = shortenTempPaths(text)
    expect(result).toBe("Writing to output.json")
  })

  it("handles multiple temp paths in one string", () => {
    const text = "Copying /var/folders/xy/abc123/T/input.txt to /tmp/output.txt"
    const result = shortenTempPaths(text)
    expect(result).toBe("Copying input.txt to output.txt")
  })

  it("preserves non-temp paths", () => {
    const text = "Reading /home/user/project/file.ts"
    const result = shortenTempPaths(text)
    expect(result).toBe("Reading /home/user/project/file.ts")
  })

  it("handles text with no temp paths", () => {
    const text = "This is just a regular string"
    const result = shortenTempPaths(text)
    expect(result).toBe("This is just a regular string")
  })

  it("handles empty string", () => {
    const result = shortenTempPaths("")
    expect(result).toBe("")
  })

  it("handles path with spaces in filename", () => {
    const text = "File at /var/folders/xy/abc/T/my file.txt exists"
    const result = shortenTempPaths(text)
    // The regex matches until whitespace, so 'my file.txt' becomes just 'my'
    expect(result).toBe("File at my file.txt exists")
  })

  it("handles path with trailing slash", () => {
    const text = "Directory /var/folders/xy/abc123/T/"
    const result = shortenTempPaths(text)
    // Path ends with /, so split('/').pop() returns empty string, regex leaves it unchanged
    expect(result).toBe("Directory /var/folders/xy/abc123/T/")
  })
})
