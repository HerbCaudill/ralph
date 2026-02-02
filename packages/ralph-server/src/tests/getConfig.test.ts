import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getConfig } from ".././index.js"

describe("getConfig", () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Create a fresh copy of env for each test
    process.env = { ...originalEnv }
    // Clear relevant env vars
    delete process.env.RALPH_SERVER_HOST
    delete process.env.RALPH_SERVER_PORT
    delete process.env.AGENT_SERVER_HOST
    delete process.env.AGENT_SERVER_PORT
    delete process.env.WORKSPACE_PATH
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns default values when no env vars are set", () => {
    const config = getConfig()
    expect(config.host).toBe("localhost")
    expect(config.port).toBe(4245)
    expect(config.workspacePath).toBe(process.cwd())
  })

  it("uses RALPH_SERVER_HOST env var", () => {
    process.env.RALPH_SERVER_HOST = "0.0.0.0"
    const config = getConfig()
    expect(config.host).toBe("0.0.0.0")
  })

  it("falls back to AGENT_SERVER_HOST env var", () => {
    process.env.AGENT_SERVER_HOST = "0.0.0.0"
    const config = getConfig()
    expect(config.host).toBe("0.0.0.0")
  })

  it("uses RALPH_SERVER_PORT env var", () => {
    process.env.RALPH_SERVER_PORT = "8080"
    const config = getConfig()
    expect(config.port).toBe(8080)
  })

  it("falls back to AGENT_SERVER_PORT env var", () => {
    process.env.AGENT_SERVER_PORT = "8080"
    const config = getConfig()
    expect(config.port).toBe(8080)
  })

  it("uses WORKSPACE_PATH env var", () => {
    process.env.WORKSPACE_PATH = "/tmp/my-workspace"
    const config = getConfig()
    expect(config.workspacePath).toBe("/tmp/my-workspace")
  })

  it("converts port to a number", () => {
    process.env.RALPH_SERVER_PORT = "3000"
    const config = getConfig()
    expect(typeof config.port).toBe("number")
    expect(config.port).toBe(3000)
  })
})
