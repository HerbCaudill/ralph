import { renderHook } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useStreamingState } from "../useStreamingState"
import type { ChatEvent } from "../../types"

describe("useStreamingState" /** Ensure tool_use input is preserved when provided in content_block_start. */, () => {
  it("keeps tool_use input from content_block_start when no input_json_delta arrives" /** Verify tool_use input is carried into completed assistant events. */, () => {
    const events: ChatEvent[] = [
      {
        type: "stream_event",
        timestamp: 100,
        event: {
          type: "message_start",
          message: { id: "msg_1" },
        },
      },
      {
        type: "stream_event",
        timestamp: 110,
        event: {
          type: "content_block_start",
          content_block: {
            type: "tool_use",
            id: "toolu_1",
            name: "Bash",
            input: { command: "pnpm test:all" },
          },
        },
      },
      {
        type: "stream_event",
        timestamp: 120,
        event: {
          type: "content_block_stop",
        },
      },
      {
        type: "stream_event",
        timestamp: 130,
        event: {
          type: "message_stop",
        },
      },
    ]

    const { result } = renderHook(() => useStreamingState(events))

    expect(result.current.completedEvents).toHaveLength(1)

    const assistantEvent = result.current.completedEvents[0]
    expect(assistantEvent.type).toBe("assistant")

    const content = (assistantEvent as { message?: { content?: unknown[] } }).message?.content
    const toolUse = content?.[0] as { type?: string; input?: Record<string, unknown> } | undefined

    expect(toolUse?.type).toBe("tool_use")
    expect(toolUse?.input).toEqual({ command: "pnpm test:all" })
  })
})
