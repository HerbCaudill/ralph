import { describe, it, expect, afterEach } from "vitest"
import { rel } from ".././rel.js"

const originalCwd = process.env.RALPH_CWD

afterEach(() => {
  if (originalCwd === undefined) {
    delete process.env.RALPH_CWD
  } else {
    process.env.RALPH_CWD = originalCwd
  }
})

describe("rel", () => {
  it("converts absolute path to relative path", () => {
    const absolutePath = `${process.cwd()}/src/lib/rel.ts`
    const result = rel(absolutePath)
    expect(result).toBe("src/lib/rel.ts")
  })

  it("returns just filename for /var/folders/ temp paths", () => {
    const tempPath = "/var/folders/xy/abc123/T/temp-file.txt"
    const result = rel(tempPath)
    expect(result).toBe("temp-file.txt")
  })

  it("returns just filename for /tmp/ paths", () => {
    const tmpPath = "/tmp/some-temp-file.json"
    const result = rel(tmpPath)
    expect(result).toBe("some-temp-file.json")
  })

  it("returns original path if already relative", () => {
    const relativePath = "src/lib/rel.ts"
    const result = rel(relativePath)
    expect(result).toBe(relativePath)
  })

  it("uses RALPH_CWD when set", () => {
    process.env.RALPH_CWD = "/Users/example/ralph"
    const absolutePath = "/Users/example/ralph/src/lib/rel.ts"
    const result = rel(absolutePath)
    expect(result).toBe("src/lib/rel.ts")
  })

  it("handles path outside current directory", () => {
    const outsidePath = "/completely/different/path/file.ts"
    const result = rel(outsidePath)
    // Should return relative path from cwd (will have ../.. etc)
    expect(result).toContain("file.ts")
  })

  it("handles root directory path", () => {
    const rootPath = "/"
    const result = rel(rootPath)
    expect(result).toBeTruthy()
  })
})
