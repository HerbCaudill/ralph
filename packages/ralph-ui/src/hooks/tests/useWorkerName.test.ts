import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useWorkerName } from "../useWorkerName"
import type { ChatEvent, UserMessageChatEvent } from "@herbcaudill/agent-view"

describe("useWorkerName", () => {
  it("returns null when no events", () => {
    const { result } = renderHook(() => useWorkerName([]))
    expect(result.current).toBeNull()
  })

  it("returns null when no user messages with worker name pattern", () => {
    const events: ChatEvent[] = [
      { type: "assistant", message: { content: [] }, timestamp: Date.now() } as ChatEvent,
    ]
    const { result } = renderHook(() => useWorkerName(events))
    expect(result.current).toBeNull()
  })

  it("extracts worker name from first user message with Ralph round header", () => {
    const events: ChatEvent[] = [
      {
        type: "user_message",
        message: "# Homer, round 3\n\nSome instructions...",
        timestamp: Date.now(),
      } as UserMessageChatEvent,
    ]
    const { result } = renderHook(() => useWorkerName(events))
    expect(result.current).toBe("Homer")
  })

  it("extracts worker name 'Ralph' from header", () => {
    const events: ChatEvent[] = [
      {
        type: "user_message",
        message: "# Ralph, round 6\n\n# Ralph session protocol...",
        timestamp: Date.now(),
      } as UserMessageChatEvent,
    ]
    const { result } = renderHook(() => useWorkerName(events))
    expect(result.current).toBe("Ralph")
  })

  it("extracts lowercase worker names", () => {
    const events: ChatEvent[] = [
      {
        type: "user_message",
        message: "# marge, round 1\n\nSome content",
        timestamp: Date.now(),
      } as UserMessageChatEvent,
    ]
    const { result } = renderHook(() => useWorkerName(events))
    expect(result.current).toBe("marge")
  })

  it("handles multiline messages correctly", () => {
    const events: ChatEvent[] = [
      {
        type: "user_message",
        message:
          "# Bart, round 42\n\n# Ralph session protocol\n\nYou are running as an autonomous session agent.",
        timestamp: Date.now(),
      } as UserMessageChatEvent,
    ]
    const { result } = renderHook(() => useWorkerName(events))
    expect(result.current).toBe("Bart")
  })

  it("ignores user messages without the round pattern", () => {
    const events: ChatEvent[] = [
      {
        type: "user_message",
        message: "Hello, can you help me?",
        timestamp: Date.now(),
      } as UserMessageChatEvent,
      {
        type: "user_message",
        message: "# Lisa, round 5\n\nInstructions...",
        timestamp: Date.now(),
      } as UserMessageChatEvent,
    ]
    const { result } = renderHook(() => useWorkerName(events))
    expect(result.current).toBe("Lisa")
  })

  it("returns the first matching worker name if multiple exist", () => {
    const events: ChatEvent[] = [
      {
        type: "user_message",
        message: "# Homer, round 1\n\nFirst session",
        timestamp: 1000,
      } as UserMessageChatEvent,
      {
        type: "user_message",
        message: "# Marge, round 2\n\nSecond session",
        timestamp: 2000,
      } as UserMessageChatEvent,
    ]
    const { result } = renderHook(() => useWorkerName(events))
    expect(result.current).toBe("Homer")
  })
})
