import { describe, it, expect } from "vitest"
import * as mainExports from "../index.js"
import * as serverExports from "../server/index.js"

describe("browser-safe exports", () => {
  it("does not export SessionPersister from main entry point", () => {
    // SessionPersister uses node:fs which breaks browser builds
    // It should be exported from @herbcaudill/ralph-shared/server instead
    expect("SessionPersister" in mainExports).toBe(false)
  })

  it("does not export getDefaultStorageDir from main entry point", () => {
    // getDefaultStorageDir uses node:os which breaks browser builds
    // It should be exported from @herbcaudill/ralph-shared/server instead
    expect("getDefaultStorageDir" in mainExports).toBe(false)
  })

  it("exports browser-safe modules from main entry point", () => {
    // These modules should remain in the main export
    expect("getWorkspaceId" in mainExports).toBe(true)
  })
})

describe("server exports", () => {
  it("exports SessionPersister from server entry point", () => {
    expect("SessionPersister" in serverExports).toBe(true)
    expect(typeof serverExports.SessionPersister).toBe("function")
  })

  it("exports getDefaultStorageDir from server entry point", () => {
    expect("getDefaultStorageDir" in serverExports).toBe(true)
    expect(typeof serverExports.getDefaultStorageDir).toBe("function")
  })
})
