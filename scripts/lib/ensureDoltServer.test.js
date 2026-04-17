import { afterEach, describe, expect, it } from "vitest"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { findDoltDataDir } from "./ensureDoltServer.js"

describe("findDoltDataDir", () => {
  /** @type {string[]} */
  const tempDirs = []

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { force: true, recursive: true })))
    tempDirs.length = 0
  })

  it("prefers the embedded dolt workspace used by beads v1", async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), "ensure-dolt-embedded-"))
    tempDirs.push(workspacePath)
    await mkdir(join(workspacePath, ".beads", "embeddeddolt", workspacePath.split("/").pop()), {
      recursive: true,
    })

    await expect(findDoltDataDir(workspacePath)).resolves.toBe(
      join(workspacePath, ".beads", "embeddeddolt", workspacePath.split("/").pop()),
    )
  })

  it("returns the shared server dolt directory for server-mode workspaces", async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), "ensure-dolt-shared-"))
    const homePath = await mkdtemp(join(tmpdir(), "ensure-dolt-home-"))
    tempDirs.push(workspacePath, homePath)
    await mkdir(join(workspacePath, ".beads"), { recursive: true })
    await mkdir(join(homePath, ".beads", "shared-server", "dolt"), { recursive: true })
    await writeFile(
      join(workspacePath, ".beads", "metadata.json"),
      JSON.stringify({ backend: "dolt", dolt_mode: "server", dolt_database: "workspace" }),
    )

    await expect(findDoltDataDir(workspacePath, homePath)).resolves.toBe(
      join(homePath, ".beads", "shared-server", "dolt"),
    )
  })

  it("falls back to the legacy .beads/dolt directory when present", async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), "ensure-dolt-legacy-"))
    tempDirs.push(workspacePath)
    await mkdir(join(workspacePath, ".beads", "dolt"), { recursive: true })

    await expect(findDoltDataDir(workspacePath)).resolves.toBe(
      join(workspacePath, ".beads", "dolt"),
    )
  })

  it("returns null when no dolt data directory exists", async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), "ensure-dolt-missing-"))
    tempDirs.push(workspacePath)

    await expect(findDoltDataDir(workspacePath)).resolves.toBeNull()
  })
})
