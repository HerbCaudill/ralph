import { describe, it, expect } from "vitest"
import { normalizeEventId } from "../normalizeEventId"
import type { ChatEvent } from "@herbcaudill/agent-view"

describe("normalizeEventId", () => {
  it("should return event unchanged if id is already set", () => {
    const event: ChatEvent = {
      type: "assistant",
      id: "existing-id",
      timestamp: 1234567890,
    }

    const result = normalizeEventId(event)

    expect(result).toBe(event) // Same reference
    expect(result.id).toBe("existing-id")
  })

  it("should copy uuid to id if id is missing but uuid is present", () => {
    const event: ChatEvent & { uuid: string } = {
      type: "assistant",
      uuid: "27137a9a-09de-4a16-951a-aafa6ab2d3f2",
      timestamp: 1234567890,
    }

    const result = normalizeEventId(event)

    expect(result.id).toBe("27137a9a-09de-4a16-951a-aafa6ab2d3f2")
    // Original event should not be mutated
    expect(event.id).toBeUndefined()
  })

  it("should return event unchanged if neither id nor uuid is present", () => {
    const event: ChatEvent = {
      type: "assistant",
      timestamp: 1234567890,
    }

    const result = normalizeEventId(event)

    expect(result).toBe(event) // Same reference
    expect(result.id).toBeUndefined()
  })

  it("should prefer existing id over uuid", () => {
    const event: ChatEvent & { uuid: string } = {
      type: "assistant",
      id: "explicit-id",
      uuid: "uuid-should-be-ignored",
      timestamp: 1234567890,
    }

    const result = normalizeEventId(event)

    expect(result.id).toBe("explicit-id")
  })

  it("should preserve all other event properties when copying uuid to id", () => {
    const event: ChatEvent & { uuid: string } = {
      type: "assistant",
      uuid: "27137a9a-09de-4a16-951a-aafa6ab2d3f2",
      timestamp: 1234567890,
      message: { content: [{ type: "text", text: "Hello" }] },
    }

    const result = normalizeEventId(event)

    expect(result.id).toBe("27137a9a-09de-4a16-951a-aafa6ab2d3f2")
    expect(result.type).toBe("assistant")
    expect(result.timestamp).toBe(1234567890)
    expect(result.message).toEqual({ content: [{ type: "text", text: "Hello" }] })
  })
})
