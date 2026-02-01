import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getConfig } from "./index.js"

describe("getConfig", () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Create a fresh copy of env for each test
    process.env = { ...originalEnv }
    // Clear relevant env vars
    delete process.env.BEADS_HOST
    delete process.env.HOST
    delete process.env.BEADS_PORT
    delete process.env.PORT
    delete process.env.WORKSPACE_PATH
    delete process.env.BEADS_DISABLE_POLLING
    delete process.env.BEADS_POLL_INTERVAL
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns default values when no env vars are set", () => {
    const config = getConfig()
    expect(config.host).toBe("localhost")
    expect(config.port).toBe(4243)
    expect(config.workspacePath).toBe(process.cwd())
    expect(config.enableMutationPolling).toBe(true)
    expect(config.mutationPollingInterval).toBe(1000)
  })

  it("uses BEADS_HOST env var", () => {
    process.env.BEADS_HOST = "0.0.0.0"
    const config = getConfig()
    expect(config.host).toBe("0.0.0.0")
  })

  it("falls back to HOST env var when BEADS_HOST is not set", () => {
    process.env.HOST = "127.0.0.1"
    const config = getConfig()
    expect(config.host).toBe("127.0.0.1")
  })

  it("prefers BEADS_HOST over HOST", () => {
    process.env.BEADS_HOST = "0.0.0.0"
    process.env.HOST = "127.0.0.1"
    const config = getConfig()
    expect(config.host).toBe("0.0.0.0")
  })

  it("uses BEADS_PORT env var", () => {
    process.env.BEADS_PORT = "8080"
    const config = getConfig()
    expect(config.port).toBe(8080)
  })

  it("falls back to PORT env var when BEADS_PORT is not set", () => {
    process.env.PORT = "3000"
    const config = getConfig()
    expect(config.port).toBe(3000)
  })

  it("prefers BEADS_PORT over PORT", () => {
    process.env.BEADS_PORT = "8080"
    process.env.PORT = "3000"
    const config = getConfig()
    expect(config.port).toBe(8080)
  })

  it("uses WORKSPACE_PATH env var", () => {
    process.env.WORKSPACE_PATH = "/tmp/my-workspace"
    const config = getConfig()
    expect(config.workspacePath).toBe("/tmp/my-workspace")
  })

  it("disables mutation polling when BEADS_DISABLE_POLLING is true", () => {
    process.env.BEADS_DISABLE_POLLING = "true"
    const config = getConfig()
    expect(config.enableMutationPolling).toBe(false)
  })

  it("keeps mutation polling enabled for non-true BEADS_DISABLE_POLLING values", () => {
    process.env.BEADS_DISABLE_POLLING = "false"
    const config = getConfig()
    expect(config.enableMutationPolling).toBe(true)
  })

  it("uses BEADS_POLL_INTERVAL env var", () => {
    process.env.BEADS_POLL_INTERVAL = "5000"
    const config = getConfig()
    expect(config.mutationPollingInterval).toBe(5000)
  })
})
