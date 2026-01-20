import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getProgress, captureStartupSnapshot } from "./getProgress.js"
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
    it("returns beads progress with timestamp-based counting", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      // Calls: created-after, status=open, status=in_progress
      // 1 created, 3 open, 1 in_progress → completed = (5+1) - (3+1) = 2
      mockExecSync.mockReturnValueOnce("1").mockReturnValueOnce("3").mockReturnValueOnce("1")

      const result = getProgress(5, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("beads")
      expect(result.completed).toBe(2) // total(6) - remaining(4) = 2
      expect(result.total).toBe(6) // 5 initial + 1 created
    })

    it("handles no progress (0 closed, 0 created)", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      // Calls: created-after, status=open, status=in_progress
      // 0 created, 3 open, 2 in_progress → completed = 5 - 5 = 0
      mockExecSync.mockReturnValueOnce("0").mockReturnValueOnce("3").mockReturnValueOnce("2")

      const result = getProgress(5, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("beads")
      expect(result.completed).toBe(0)
      expect(result.total).toBe(5)
    })

    it("handles all closed", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      // Calls: created-after, status=open, status=in_progress
      // 0 created, 0 open, 0 in_progress → completed = 5 - 0 = 5
      mockExecSync.mockReturnValueOnce("0").mockReturnValueOnce("0").mockReturnValueOnce("0")

      const result = getProgress(5, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("beads")
      expect(result.completed).toBe(5)
      expect(result.total).toBe(5)
    })

    it("returns none when bd command fails", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return true
        return false
      })
      mockExecSync.mockImplementation(() => {
        throw new Error("Command failed")
      })

      const result = getProgress(5, "2024-01-01T00:00:00.000Z")

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

      const result = getProgress(4, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("todo")
      expect(result.completed).toBe(2) // 2 checked
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

      const result = getProgress(3, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("todo")
      expect(result.completed).toBe(0)
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

      const result = getProgress(2, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("todo")
      expect(result.completed).toBe(2)
      expect(result.total).toBe(2)
    })

    it("handles empty todo file", () => {
      mockExistsSync.mockImplementation(path => {
        if (typeof path === "string" && path.endsWith(".beads")) return false
        if (typeof path === "string" && path.endsWith("todo.md")) return true
        return false
      })
      mockReadFileSync.mockReturnValue("")

      const result = getProgress(0, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("todo")
      expect(result.completed).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe("with no workspace", () => {
    it("returns none when neither .beads nor todo.md exists", () => {
      mockExistsSync.mockReturnValue(false)

      const result = getProgress(0, "2024-01-01T00:00:00.000Z")

      expect(result.type).toBe("none")
      expect(result.completed).toBe(0)
      expect(result.total).toBe(0)
    })
  })
})

describe("captureStartupSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-15T10:30:00.000Z"))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("returns snapshot when .beads exists", () => {
    mockExistsSync.mockImplementation(path => {
      if (typeof path === "string" && path.endsWith(".beads")) return true
      return false
    })
    mockExecSync.mockReturnValueOnce("2").mockReturnValueOnce("1")

    const result = captureStartupSnapshot()

    expect(result).toEqual({
      initialCount: 3,
      timestamp: "2024-06-15T10:30:00.000Z",
      type: "beads",
    })
  })

  it("returns snapshot for todo.md workspace", () => {
    mockExistsSync.mockImplementation(path => {
      if (typeof path === "string" && path.endsWith(".beads")) return false
      if (typeof path === "string" && path.endsWith("todo.md")) return true
      return false
    })
    mockReadFileSync.mockReturnValue(`
- [ ] Task 1
- [x] Task 2
`)

    const result = captureStartupSnapshot()

    expect(result).toEqual({
      initialCount: 2,
      timestamp: "2024-06-15T10:30:00.000Z",
      type: "todo",
    })
  })

  it("returns undefined when neither .beads nor todo.md exists", () => {
    mockExistsSync.mockReturnValue(false)

    const result = captureStartupSnapshot()

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

    const result = captureStartupSnapshot()

    expect(result).toBeUndefined()
  })
})
