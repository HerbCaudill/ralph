import { describe, it, expect } from "vitest"
import { toRelativePath } from "./toRelativePath"

describe("toRelativePath", () => {
  it("returns relative path when file is in workspace", () => {
    const workspace = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui"
    const filePath = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/components/ui/dialog.tsx"
    expect(toRelativePath(filePath, workspace)).toBe("src/components/ui/dialog.tsx")
  })

  it("returns original path when workspace is null", () => {
    const filePath = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/components/ui/dialog.tsx"
    expect(toRelativePath(filePath, null)).toBe(filePath)
  })

  it("returns original path when file is not in workspace", () => {
    const workspace = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui"
    const filePath = "/Users/herbcaudill/Code/HerbCaudill/other-project/src/index.ts"
    expect(toRelativePath(filePath, workspace)).toBe(filePath)
  })

  it("handles workspace path with trailing slash", () => {
    const workspace = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/"
    const filePath = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/App.tsx"
    expect(toRelativePath(filePath, workspace)).toBe("src/App.tsx")
  })

  it("handles nested file paths correctly", () => {
    const workspace = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui"
    const filePath =
      "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/src/components/events/EventStream.tsx"
    expect(toRelativePath(filePath, workspace)).toBe("src/components/events/EventStream.tsx")
  })

  it("handles root-level files in workspace", () => {
    const workspace = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui"
    const filePath = "/Users/herbcaudill/Code/HerbCaudill/ralph-ui/package.json"
    expect(toRelativePath(filePath, workspace)).toBe("package.json")
  })

  it("does not strip partial path matches", () => {
    const workspace = "/Users/test/project"
    const filePath = "/Users/test/project-backup/src/index.ts"
    expect(toRelativePath(filePath, workspace)).toBe(filePath)
  })
})
