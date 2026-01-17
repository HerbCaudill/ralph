import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getProgress, getInitialBeadsCount } from "./getProgress.js"
import * as fs from "fs"
import * as child_process from "child_process"

vi.mock("fs")
vi.mock("child_process")

const mockExistsSync = vi.mocked(fs.existsSync)
const mockReadFileSync = vi.mocked(fs.readFileSync)
const mockExecSync = vi.mocked(child_process.execSync)

describe("getProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("with beads workspace", () => {
    it("returns beads progress when .beads directory exists", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      mockExecSync.mockReturnValue("beads-1\nbeads-2\nbeads-3\n")

      const result = getProgress(5)

      expect(result.type).toBe("beads")
      expect(result.remaining).toBe(3)
      expect(result.total).toBe(5)
    })

    it("handles empty beads list", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      mockExecSync.mockReturnValue("")

      const result = getProgress(5)

      expect(result.type).toBe("beads")
      expect(result.remaining).toBe(0)
      expect(result.total).toBe(5)
    })

    it("uses remaining as total when no initial provided", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      mockExecSync.mockReturnValue("beads-1\nbeads-2\n")

      const result = getProgress()

      expect(result.type).toBe("beads")
      expect(result.remaining).toBe(2)
      expect(result.total).toBe(2)
    })

    it("returns none when bd command fails", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      mockExecSync.mockImplementation(() => {
        throw new Error("Command failed")
      })

      const result = getProgress()

      expect(result.type).toBe("none")
    })
  })

  describe("with todo.md workspace", () => {
    it("returns todo progress when todo.md exists", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return false
        if (typeof path === "string" && path.endsWith("todo.md")) return true
        return false
      })
      mockReadFileSync.mockReturnValue(`
### To do
- [ ] Task 1
- [ ] Task 2
- [x] Task 3
- [X] Task 4

### Done
`)

      const result = getProgress()

      expect(result.type).toBe("todo")
      expect(result.remaining).toBe(2)
      expect(result.total).toBe(4)
    })

    it("handles all unchecked items", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return false
        if (typeof path === "string" && path.endsWith("todo.md")) return true
        return false
      })
      mockReadFileSync.mockReturnValue(`
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
`)

      const result = getProgress()

      expect(result.type).toBe("todo")
      expect(result.remaining).toBe(3)
      expect(result.total).toBe(3)
    })

    it("handles all checked items", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return false
        if (typeof path === "string" && path.endsWith("todo.md")) return true
        return false
      })
      mockReadFileSync.mockReturnValue(`
- [x] Task 1
- [X] Task 2
`)

      const result = getProgress()

      expect(result.type).toBe("todo")
      expect(result.remaining).toBe(0)
      expect(result.total).toBe(2)
    })

    it("handles empty todo file", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return false
        if (typeof path === "string" && path.endsWith("todo.md")) return true
        return false
      })
      mockReadFileSync.mockReturnValue("")

      const result = getProgress()

      expect(result.type).toBe("todo")
      expect(result.remaining).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe("with no workspace", () => {
    it("returns none when neither .beads nor todo.md exists", () => {
      mockExistsSync.mockReturnValue(false)

      const result = getProgress()

      expect(result.type).toBe("none")
      expect(result.remaining).toBe(0)
      expect(result.total).toBe(0)
    })
  })
})

describe("getInitialBeadsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns count when .beads exists", () => {
    mockExistsSync.mockImplementation(path => {
      if (typeof path === "string" && path.endsWith(".beads")) return true
      return false
    })
    mockExecSync.mockReturnValue("beads-1\nbeads-2\nbeads-3\n")

    const result = getInitialBeadsCount()

    expect(result).toBe(3)
  })

  it("returns undefined when .beads does not exist", () => {
    mockExistsSync.mockReturnValue(false)

    const result = getInitialBeadsCount()

    expect(result).toBeUndefined()
  })

  it("returns undefined when bd command fails", () => {
    mockExistsSync.mockImplementation(path => {
      if (typeof path === "string" && path.endsWith(".beads")) return true
      return false
    })
    mockExecSync.mockImplementation(() => {
      throw new Error("Command failed")
    })

    const result = getInitialBeadsCount()

    expect(result).toBeUndefined()
  })
})
