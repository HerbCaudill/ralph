import { describe, it, expect } from "vitest"
import { WorkspaceNotFoundError } from "../types.js"

describe("WorkspaceNotFoundError", () => {
  it("extends Error", () => {
    const error = new WorkspaceNotFoundError("herbcaudill/ralph")
    expect(error).toBeInstanceOf(Error)
  })

  it("has the correct name", () => {
    const error = new WorkspaceNotFoundError("herbcaudill/ralph")
    expect(error.name).toBe("WorkspaceNotFoundError")
  })

  it("includes the workspace in the message", () => {
    const error = new WorkspaceNotFoundError("herbcaudill/ralph")
    expect(error.message).toBe("workspace not found: herbcaudill/ralph")
  })

  it("exposes the workspace as a property", () => {
    const error = new WorkspaceNotFoundError("herbcaudill/ralph")
    expect(error.workspace).toBe("herbcaudill/ralph")
  })
})
