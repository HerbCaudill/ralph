import { describe, it, expect } from "vitest"
import { createBatchConverter } from ".././adapter"
import type { ConvertEvent } from ".././adapter"

describe("createBatchConverter", () => {
  it("should convert single events using convertEvent", () => {
    const convertEvent: ConvertEvent = (nativeEvent: unknown) => {
      const event = nativeEvent as { type: string; data: string }
      return [
        {
          type: event.type,
          timestamp: Date.now(),
          data: event.data,
        },
      ]
    }

    const convertEvents = createBatchConverter(convertEvent)
    const nativeEvents = [
      { type: "test1", data: "data1" },
      { type: "test2", data: "data2" },
    ]

    const result = convertEvents(nativeEvents)

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe("test1")
    expect(result[0].data).toBe("data1")
    expect(result[1].type).toBe("test2")
    expect(result[1].data).toBe("data2")
  })

  it("should handle convertEvent returning multiple events", () => {
    const convertEvent: ConvertEvent = (nativeEvent: unknown) => {
      const event = nativeEvent as { type: string }
      return [
        { type: `${event.type}_1`, timestamp: Date.now() },
        { type: `${event.type}_2`, timestamp: Date.now() },
      ]
    }

    const convertEvents = createBatchConverter(convertEvent)
    const nativeEvents = [{ type: "test" }]

    const result = convertEvents(nativeEvents)

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe("test_1")
    expect(result[1].type).toBe("test_2")
  })

  it("should handle convertEvent returning zero events", () => {
    const convertEvent: ConvertEvent = (_nativeEvent: unknown) => {
      return []
    }

    const convertEvents = createBatchConverter(convertEvent)
    const nativeEvents = [{ type: "filtered" }, { type: "also_filtered" }]

    const result = convertEvents(nativeEvents)

    expect(result).toHaveLength(0)
  })

  it("should handle empty input array", () => {
    const convertEvent: ConvertEvent = (_nativeEvent: unknown) => {
      return [{ type: "test", timestamp: Date.now() }]
    }

    const convertEvents = createBatchConverter(convertEvent)
    const result = convertEvents([])

    expect(result).toHaveLength(0)
  })

  it("should handle mixed results from convertEvent", () => {
    const convertEvent: ConvertEvent = (nativeEvent: unknown) => {
      const event = nativeEvent as { include: boolean; type: string }
      return event.include ? [{ type: event.type, timestamp: Date.now() }] : []
    }

    const convertEvents = createBatchConverter(convertEvent)
    const nativeEvents = [
      { include: true, type: "included1" },
      { include: false, type: "filtered" },
      { include: true, type: "included2" },
    ]

    const result = convertEvents(nativeEvents)

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe("included1")
    expect(result[1].type).toBe("included2")
  })

  it("should preserve event order", () => {
    const convertEvent: ConvertEvent = (nativeEvent: unknown) => {
      const event = nativeEvent as { id: number }
      return [{ type: "event", timestamp: event.id, id: String(event.id) }]
    }

    const convertEvents = createBatchConverter(convertEvent)
    const nativeEvents = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]

    const result = convertEvents(nativeEvents)

    expect(result.map(e => (e as any).id)).toEqual(["1", "2", "3", "4", "5"])
  })

  it("should handle complex event transformations", () => {
    const convertEvent: ConvertEvent = (nativeEvent: unknown) => {
      const event = nativeEvent as { messages: string[] }
      return event.messages.map(msg => ({
        type: "message",
        timestamp: Date.now(),
        content: msg,
      }))
    }

    const convertEvents = createBatchConverter(convertEvent)
    const nativeEvents = [{ messages: ["hello", "world"] }, { messages: ["foo"] }, { messages: [] }]

    const result = convertEvents(nativeEvents)

    expect(result).toHaveLength(3)
    expect((result[0] as any).content).toBe("hello")
    expect((result[1] as any).content).toBe("world")
    expect((result[2] as any).content).toBe("foo")
  })
})
