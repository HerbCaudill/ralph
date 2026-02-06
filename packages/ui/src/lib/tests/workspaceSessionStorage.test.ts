import { describe, it, expect, beforeEach } from "vitest"
import {
  getSessionStorageKey,
  saveWorkspaceSession,
  loadWorkspaceSession,
  clearWorkspaceSession,
} from "../workspaceSessionStorage"

describe("workspaceSessionStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe("getSessionStorageKey", () => {
    it("should return the prefixed key for a workspace", () => {
      expect(getSessionStorageKey("herbcaudill/ralph")).toBe(
        "ralph-workspace-session:herbcaudill/ralph",
      )
    })
  })

  describe("saveWorkspaceSession", () => {
    it("should store a session ID in localStorage", () => {
      saveWorkspaceSession("herbcaudill/ralph", "session-abc123")
      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/ralph")).toBe(
        "session-abc123",
      )
    })

    it("should overwrite a previously stored session ID", () => {
      saveWorkspaceSession("herbcaudill/ralph", "session-old")
      saveWorkspaceSession("herbcaudill/ralph", "session-new")
      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/ralph")).toBe("session-new")
    })

    it("should store session IDs independently per workspace", () => {
      saveWorkspaceSession("herbcaudill/ralph", "session-1")
      saveWorkspaceSession("herbcaudill/other", "session-2")
      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/ralph")).toBe("session-1")
      expect(localStorage.getItem("ralph-workspace-session:herbcaudill/other")).toBe("session-2")
    })
  })

  describe("loadWorkspaceSession", () => {
    it("should return null when no session is stored", () => {
      expect(loadWorkspaceSession("herbcaudill/ralph")).toBeNull()
    })

    it("should return the stored session ID", () => {
      localStorage.setItem("ralph-workspace-session:herbcaudill/ralph", "session-xyz")
      expect(loadWorkspaceSession("herbcaudill/ralph")).toBe("session-xyz")
    })
  })

  describe("clearWorkspaceSession", () => {
    it("should remove the stored session ID", () => {
      saveWorkspaceSession("herbcaudill/ralph", "session-abc")
      clearWorkspaceSession("herbcaudill/ralph")
      expect(loadWorkspaceSession("herbcaudill/ralph")).toBeNull()
    })

    it("should not throw when clearing a non-existent session", () => {
      expect(() => clearWorkspaceSession("herbcaudill/ralph")).not.toThrow()
    })
  })
})
