import { describe, it, expect } from "vitest"
import { cycleWorkspace } from "../cycleWorkspace"
import type { Workspace } from "../../hooks/useWorkspace"

const makeWorkspace = (path: string, name?: string): Workspace => ({
  path,
  name: name ?? path.split("/").pop()!,
})

const workspaces: Workspace[] = [
  makeWorkspace("/a", "Alpha"),
  makeWorkspace("/b", "Beta"),
  makeWorkspace("/c", "Gamma"),
]

describe("cycleWorkspace", () => {
  describe("next direction", () => {
    it("returns the next workspace", () => {
      const result = cycleWorkspace(workspaces, workspaces[0], "next")
      expect(result).toEqual(workspaces[1])
    })

    it("wraps around to the first workspace when at the end", () => {
      const result = cycleWorkspace(workspaces, workspaces[2], "next")
      expect(result).toEqual(workspaces[0])
    })
  })

  describe("previous direction", () => {
    it("returns the previous workspace", () => {
      const result = cycleWorkspace(workspaces, workspaces[1], "previous")
      expect(result).toEqual(workspaces[0])
    })

    it("wraps around to the last workspace when at the beginning", () => {
      const result = cycleWorkspace(workspaces, workspaces[0], "previous")
      expect(result).toEqual(workspaces[2])
    })
  })

  describe("edge cases", () => {
    it("returns null when there are fewer than 2 workspaces", () => {
      const result = cycleWorkspace([workspaces[0]], workspaces[0], "next")
      expect(result).toBeNull()
    })

    it("returns null for an empty list", () => {
      const result = cycleWorkspace([], null, "next")
      expect(result).toBeNull()
    })

    it("returns null when current is null", () => {
      const result = cycleWorkspace(workspaces, null, "next")
      expect(result).toBeNull()
    })

    it("returns null when current workspace is not in the list", () => {
      const notInList = makeWorkspace("/unknown", "Unknown")
      const result = cycleWorkspace(workspaces, notInList, "next")
      expect(result).toBeNull()
    })
  })
})
