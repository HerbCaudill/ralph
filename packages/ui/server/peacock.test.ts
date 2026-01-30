import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import { readPeacockColor } from "./index.js"

describe("readPeacockColor", () => {
  const testDir = path.join(import.meta.dirname, "__test_peacock__")
  const vscodeDir = path.join(testDir, ".vscode")
  const settingsPath = path.join(vscodeDir, "settings.json")

  beforeEach(async () => {
    // Create test directory structure
    await mkdir(vscodeDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
  })

  it("returns peacock color from settings.json", async () => {
    const settings = {
      "peacock.color": "#4d9697",
      "other.setting": "value",
    }
    await writeFile(settingsPath, JSON.stringify(settings))

    const color = await readPeacockColor(testDir)
    expect(color).toBe("#4d9697")
  })

  it("returns null when .vscode/settings.json does not exist", async () => {
    // Don't create settings.json
    const color = await readPeacockColor(testDir)
    expect(color).toBeNull()
  })

  it("returns null when peacock.color is not set", async () => {
    const settings = {
      "other.setting": "value",
    }
    await writeFile(settingsPath, JSON.stringify(settings))

    const color = await readPeacockColor(testDir)
    expect(color).toBeNull()
  })

  it("returns null when settings.json is invalid JSON", async () => {
    await writeFile(settingsPath, "{ invalid json }")

    const color = await readPeacockColor(testDir)
    expect(color).toBeNull()
  })

  it("returns null when workspace path does not exist", async () => {
    const color = await readPeacockColor("/nonexistent/path")
    expect(color).toBeNull()
  })

  it("handles settings with JSON comments", async () => {
    // Note: JSON.parse doesn't support comments, so this should return null
    const settingsWithComments = `{
      // This is a comment
      "peacock.color": "#4d9697"
    }`
    await writeFile(settingsPath, settingsWithComments)

    const color = await readPeacockColor(testDir)
    // Standard JSON.parse fails on comments, so null is expected
    expect(color).toBeNull()
  })
})
