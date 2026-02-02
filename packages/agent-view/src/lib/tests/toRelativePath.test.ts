import { describe, it, expect } from "vitest"
import { toRelativePath } from ".././toRelativePath"

describe("toRelativePath", () => {
  describe("when workspace is null", () => {
    it("should return absolute path unchanged", () => {
      const path = "/Users/test/project/src/file.ts"
      expect(toRelativePath(path, null)).toBe(path)
    })
  })

  describe("when path is within workspace", () => {
    it("should strip workspace path", () => {
      const workspace = "/Users/test/project"
      const absolutePath = "/Users/test/project/src/file.ts"
      expect(toRelativePath(absolutePath, workspace)).toBe("src/file.ts")
    })

    it("should handle workspace with trailing slash", () => {
      const workspace = "/Users/test/project/"
      const absolutePath = "/Users/test/project/src/file.ts"
      expect(toRelativePath(absolutePath, workspace)).toBe("src/file.ts")
    })

    it("should handle file in workspace root", () => {
      const workspace = "/Users/test/project"
      const absolutePath = "/Users/test/project/README.md"
      expect(toRelativePath(absolutePath, workspace)).toBe("README.md")
    })

    it("should handle nested directories", () => {
      const workspace = "/Users/test/project"
      const absolutePath = "/Users/test/project/src/components/Button.tsx"
      expect(toRelativePath(absolutePath, workspace)).toBe("src/components/Button.tsx")
    })
  })

  describe("when path is not within workspace", () => {
    it("should return absolute path unchanged", () => {
      const workspace = "/Users/test/project"
      const absolutePath = "/Users/other/file.ts"
      expect(toRelativePath(absolutePath, workspace)).toBe(absolutePath)
    })

    it("should handle similar but different paths", () => {
      const workspace = "/Users/test/project"
      const absolutePath = "/Users/test/project-other/file.ts"
      expect(toRelativePath(absolutePath, workspace)).toBe(absolutePath)
    })
  })

  describe("path normalization", () => {
    it("should handle path without leading slash when workspace has one", () => {
      const workspace = "/Users/test/project"
      const absolutePath = "Users/test/project/src/file.ts"
      expect(toRelativePath(absolutePath, workspace)).toBe("src/file.ts")
    })

    it("should normalize workspace without trailing slash", () => {
      const workspace = "/Users/test/project"
      const absolutePath = "/Users/test/project/file.ts"
      expect(toRelativePath(absolutePath, workspace)).toBe("file.ts")
    })
  })

  describe("edge cases", () => {
    it("should handle empty workspace", () => {
      expect(toRelativePath("/path/to/file", "")).toBe("/path/to/file")
    })

    it("should handle root workspace", () => {
      const workspace = "/"
      const absolutePath = "/src/file.ts"
      expect(toRelativePath(absolutePath, workspace)).toBe("src/file.ts")
    })
  })
})
