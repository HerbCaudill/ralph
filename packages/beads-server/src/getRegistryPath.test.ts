import { describe, it, expect } from "vitest"
import os from "node:os"
import path from "node:path"
import { getRegistryPath } from "./getRegistryPath.js"

describe("getRegistryPath", () => {
  it("returns a path ending in .beads/registry.json", () => {
    const result = getRegistryPath()
    expect(result).toMatch(/\.beads\/registry\.json$/)
  })

  it("starts with the user home directory", () => {
    const result = getRegistryPath()
    expect(result).toBe(path.join(os.homedir(), ".beads", "registry.json"))
  })

  it("returns an absolute path", () => {
    const result = getRegistryPath()
    expect(path.isAbsolute(result)).toBe(true)
  })
})
