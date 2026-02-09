import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useCurrentTask } from "../useCurrentTask"
import type { ChatEvent, TaskLifecycleChatEvent } from "@herbcaudill/agent-view"

describe("useCurrentTask", () => {
  it("returns null taskId and taskTitle when no events", () => {
    const { result } = renderHook(() => useCurrentTask([]))
    expect(result.current).toEqual({ taskId: null, taskTitle: null })
  })

  it("returns null taskId and taskTitle when no task lifecycle events", () => {
    const events: ChatEvent[] = [
      { type: "user_message", message: "hello", timestamp: Date.now() } as ChatEvent,
    ]
    const { result } = renderHook(() => useCurrentTask(events))
    expect(result.current).toEqual({ taskId: null, taskTitle: null })
  })

  it("returns taskId when last lifecycle event is starting", () => {
    const events: ChatEvent[] = [
      {
        type: "task_lifecycle",
        action: "starting",
        taskId: "r-abc123",
        timestamp: Date.now(),
      } as TaskLifecycleChatEvent,
    ]
    const { result } = renderHook(() => useCurrentTask(events))
    expect(result.current.taskId).toBe("r-abc123")
  })

  it("returns null taskId when last lifecycle event is completed", () => {
    const events: ChatEvent[] = [
      {
        type: "task_lifecycle",
        action: "starting",
        taskId: "r-abc123",
        timestamp: Date.now(),
      } as TaskLifecycleChatEvent,
      {
        type: "task_lifecycle",
        action: "completed",
        taskId: "r-abc123",
        timestamp: Date.now(),
      } as TaskLifecycleChatEvent,
    ]
    const { result } = renderHook(() => useCurrentTask(events))
    expect(result.current).toEqual({ taskId: null, taskTitle: null })
  })

  it("resolves taskTitle from tasks array when provided", () => {
    const events: ChatEvent[] = [
      {
        type: "task_lifecycle",
        action: "starting",
        taskId: "r-abc123",
        timestamp: Date.now(),
      } as TaskLifecycleChatEvent,
    ]
    const tasks = [
      { id: "r-abc123", title: "Fix the login bug" },
      { id: "r-def456", title: "Add dark mode" },
    ]
    const { result } = renderHook(() => useCurrentTask(events, tasks as any))
    expect(result.current).toEqual({ taskId: "r-abc123", taskTitle: "Fix the login bug" })
  })

  it("returns null taskTitle when task not found in tasks array", () => {
    const events: ChatEvent[] = [
      {
        type: "task_lifecycle",
        action: "starting",
        taskId: "r-abc123",
        timestamp: Date.now(),
      } as TaskLifecycleChatEvent,
    ]
    const tasks = [{ id: "r-def456", title: "Add dark mode" }]
    const { result } = renderHook(() => useCurrentTask(events, tasks as any))
    expect(result.current).toEqual({ taskId: "r-abc123", taskTitle: null })
  })

  it("returns null taskTitle when tasks array is not provided", () => {
    const events: ChatEvent[] = [
      {
        type: "task_lifecycle",
        action: "starting",
        taskId: "r-abc123",
        timestamp: Date.now(),
      } as TaskLifecycleChatEvent,
    ]
    const { result } = renderHook(() => useCurrentTask(events))
    expect(result.current).toEqual({ taskId: "r-abc123", taskTitle: null })
  })
})
