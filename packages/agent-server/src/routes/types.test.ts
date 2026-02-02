import { describe, it, expect, vi } from "vitest"
import { serializeInstanceState } from "./types.js"

describe("serializeInstanceState", () => {
  it("serializes instance state with status from manager", () => {
    const state = {
      id: "inst-1",
      name: "My Instance",
      agentName: "Ralph",
      worktreePath: "/tmp/worktree",
      workspaceId: "ws-1",
      branch: "feature/test",
      createdAt: "2025-01-01T00:00:00Z",
      currentTaskId: "task-1",
      currentTaskTitle: "Fix bug",
      manager: { status: "running" as const },
      mergeConflict: undefined,
    }

    const result = serializeInstanceState(state as any)

    expect(result).toEqual({
      id: "inst-1",
      name: "My Instance",
      agentName: "Ralph",
      worktreePath: "/tmp/worktree",
      workspaceId: "ws-1",
      branch: "feature/test",
      createdAt: "2025-01-01T00:00:00Z",
      currentTaskId: "task-1",
      currentTaskTitle: "Fix bug",
      status: "running",
      mergeConflict: undefined,
    })
  })

  it("excludes the manager property from output", () => {
    const state = {
      id: "inst-2",
      name: "Instance 2",
      agentName: "Test",
      worktreePath: "/tmp/wt2",
      workspaceId: "ws-2",
      branch: "main",
      createdAt: "2025-06-01T00:00:00Z",
      currentTaskId: null,
      currentTaskTitle: null,
      manager: { status: "stopped" as const, someOtherProp: true },
      mergeConflict: undefined,
    }

    const result = serializeInstanceState(state as any)

    expect(result).not.toHaveProperty("manager")
    expect(result.status).toBe("stopped")
  })

  it("includes mergeConflict when present", () => {
    const state = {
      id: "inst-3",
      name: "Conflicted",
      agentName: "Ralph",
      worktreePath: "/tmp/wt3",
      workspaceId: "ws-3",
      branch: "feature/conflict",
      createdAt: "2025-06-01T00:00:00Z",
      currentTaskId: null,
      currentTaskTitle: null,
      manager: { status: "stopped" as const },
      mergeConflict: { files: ["src/index.ts"], message: "Conflict detected" },
    }

    const result = serializeInstanceState(state as any)

    expect(result.mergeConflict).toEqual({
      files: ["src/index.ts"],
      message: "Conflict detected",
    })
  })
})
