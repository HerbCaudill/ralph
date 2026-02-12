import { describe, it, expect, beforeEach } from "vitest"
import {
  saveWorkspaceSession,
  loadWorkspaceSession,
  clearWorkspaceSession,
  saveWorkspaceState,
  loadWorkspaceState,
} from "../workspaceSessionStorage"

describe("workspaceSessionStorage", () => {
  beforeEach(() => {
    localStorage.clear()
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

  describe("saveWorkspaceState", () => {
    it("should store 'running' state in localStorage", () => {
      saveWorkspaceState("herbcaudill/ralph", "running")
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBe("running")
    })

    it("should store 'paused' state in localStorage", () => {
      saveWorkspaceState("herbcaudill/ralph", "paused")
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBe("paused")
    })

    it("should clear state from localStorage when set to 'idle'", () => {
      saveWorkspaceState("herbcaudill/ralph", "running")
      saveWorkspaceState("herbcaudill/ralph", "idle")
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBeNull()
    })

    it("should store state independently per workspace", () => {
      saveWorkspaceState("herbcaudill/ralph", "running")
      saveWorkspaceState("herbcaudill/other", "paused")
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/ralph")).toBe("running")
      expect(localStorage.getItem("ralph-workspace-state:herbcaudill/other")).toBe("paused")
    })
  })

  describe("loadWorkspaceState", () => {
    it("should return null when no state is stored", () => {
      expect(loadWorkspaceState("herbcaudill/ralph")).toBeNull()
    })

    it("should return 'running' when stored", () => {
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "running")
      expect(loadWorkspaceState("herbcaudill/ralph")).toBe("running")
    })

    it("should return null for idle state", () => {
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "idle")
      expect(loadWorkspaceState("herbcaudill/ralph")).toBeNull()
    })

    it("should return null for invalid values", () => {
      localStorage.setItem("ralph-workspace-state:herbcaudill/ralph", "invalid")
      expect(loadWorkspaceState("herbcaudill/ralph")).toBeNull()
    })
  })
})
