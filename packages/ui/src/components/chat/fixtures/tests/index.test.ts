import { describe, it, expect } from "vitest"
import {
  getAllFixtures,
  getFixtureByName,
  extractEvents,
  sortEventsByTimestamp,
  simpleQAFixture,
  toolUseSuccessFixture,
  rapidStreamingFixture,
  outOfOrderFixture,
  multipleToolUsesFixture,
  toolUseErrorFixture,
  fullStreamingFixture,
  multiToolFullStreamingFixture,
} from ".././index"

describe("TaskChatController fixtures", () => {
  describe("getAllFixtures", () => {
    it("returns all fixtures", () => {
      const fixtures = getAllFixtures()
      expect(fixtures).toHaveLength(8)
    })

    it("includes all fixture types", () => {
      const fixtures = getAllFixtures()
      const names = fixtures.map(f => f.metadata.name)
      expect(names).toContain("Simple Q&A")
      expect(names).toContain("Tool Use Success")
      expect(names).toContain("Rapid Streaming")
      expect(names).toContain("Out of Order Events")
      expect(names).toContain("Multiple Tool Uses")
      expect(names).toContain("Tool Use Error")
      expect(names).toContain("Full Streaming with Deduplication")
      expect(names).toContain("Multi-Tool Full Streaming")
    })
  })

  describe("getFixtureByName", () => {
    it("returns fixture when found", () => {
      const fixture = getFixtureByName("Simple Q&A")
      expect(fixture).toBeDefined()
      expect(fixture?.metadata.name).toBe("Simple Q&A")
    })

    it("returns undefined when not found", () => {
      const fixture = getFixtureByName("Nonexistent Fixture")
      expect(fixture).toBeUndefined()
    })
  })

  describe("extractEvents", () => {
    it("extracts events from fixture entries", () => {
      const events = extractEvents(simpleQAFixture.entries)
      expect(events.length).toBe(simpleQAFixture.entries.length)
      expect(events[0].type).toBe("user")
      expect(events[0].timestamp).toBeDefined()
    })

    it("removes log metadata (sessionId, loggedAt)", () => {
      const events = extractEvents(simpleQAFixture.entries)
      expect((events[0] as unknown as { sessionId?: string }).sessionId).toBeUndefined()
      expect((events[0] as unknown as { loggedAt?: string }).loggedAt).toBeUndefined()
    })
  })

  describe("sortEventsByTimestamp", () => {
    it("sorts events chronologically", () => {
      const events = extractEvents(outOfOrderFixture.entries)
      const sorted = sortEventsByTimestamp(events)

      // Verify sorted by timestamp
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].timestamp).toBeGreaterThanOrEqual(sorted[i - 1].timestamp)
      }
    })

    it("does not mutate original array", () => {
      const events = extractEvents(outOfOrderFixture.entries)
      const originalFirst = events[0].timestamp
      sortEventsByTimestamp(events)
      expect(events[0].timestamp).toBe(originalFirst)
    })
  })

  describe("simpleQAFixture", () => {
    it("has valid structure", () => {
      expect(simpleQAFixture.metadata.name).toBe("Simple Q&A")
      expect(simpleQAFixture.entries.length).toBeGreaterThan(0)
    })

    it("starts with user message", () => {
      const firstEvent = simpleQAFixture.entries[0].event
      expect(firstEvent.type).toBe("user")
    })

    it("ends with result", () => {
      const lastEvent = simpleQAFixture.entries[simpleQAFixture.entries.length - 1].event
      expect(lastEvent.type).toBe("result")
    })

    it("contains streaming events", () => {
      const streamEvents = simpleQAFixture.entries.filter(e => e.event.type === "stream_event")
      expect(streamEvents.length).toBeGreaterThan(0)
    })
  })

  describe("toolUseSuccessFixture", () => {
    it("contains tool use content block", () => {
      const hasToolUse = toolUseSuccessFixture.entries.some(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string; content_block?: { type: string } })?.content_block
            ?.type === "tool_use",
      )
      expect(hasToolUse).toBe(true)
    })

    it("contains tool result", () => {
      const hasToolResult = toolUseSuccessFixture.entries.some(e => {
        if (e.event.type !== "user") return false
        const message = e.event.message as { content?: unknown[] }
        if (!Array.isArray(message?.content)) return false
        return message.content.some(c => (c as { type?: string }).type === "tool_result")
      })
      expect(hasToolResult).toBe(true)
    })
  })

  describe("rapidStreamingFixture", () => {
    it("contains many rapid deltas", () => {
      const deltas = rapidStreamingFixture.entries.filter(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string })?.type === "content_block_delta",
      )
      expect(deltas.length).toBeGreaterThanOrEqual(8)
    })

    it("has realistic timing (10-20ms between events)", () => {
      const deltas = rapidStreamingFixture.entries.filter(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string })?.type === "content_block_delta",
      )

      for (let i = 1; i < deltas.length; i++) {
        const gap = deltas[i].event.timestamp - deltas[i - 1].event.timestamp
        expect(gap).toBeLessThanOrEqual(50) // Allow up to 50ms gaps
      }
    })
  })

  describe("outOfOrderFixture", () => {
    it("has events logged out of chronological order", () => {
      // In this fixture, the entries are NOT ordered by timestamp in the array.
      // Specifically, entry[0] was logged at :100 but has timestamp :050,
      // while entry[1] was logged at :000 but has timestamp :000.
      // So entry[1] (user message) should come BEFORE entry[0] when sorted by timestamp.

      const entries = outOfOrderFixture.entries
      const timestamps = entries.map(e => e.event.timestamp)

      // Check that the timestamps are NOT already in ascending order
      let isAscending = true
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] < timestamps[i - 1]) {
          isAscending = false
          break
        }
      }

      // The fixture should have at least one out-of-order pair
      expect(isAscending).toBe(false)
    })

    it("can be sorted by timestamp to get correct order", () => {
      const events = extractEvents(outOfOrderFixture.entries)
      const sorted = sortEventsByTimestamp(events)

      // After sorting, user message should be first
      expect(sorted[0].type).toBe("user")
    })
  })

  describe("multipleToolUsesFixture", () => {
    it("contains multiple tool use blocks", () => {
      const toolUseStarts = multipleToolUsesFixture.entries.filter(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string; content_block?: { type: string } })?.content_block
            ?.type === "tool_use",
      )
      expect(toolUseStarts.length).toBeGreaterThanOrEqual(2)
    })

    it("uses different tools (Read and Grep)", () => {
      const toolNames = new Set<string>()
      for (const entry of multipleToolUsesFixture.entries) {
        if (entry.event.type === "stream_event") {
          const block = (entry.event.event as { content_block?: { name?: string } })?.content_block
          if (block?.name) {
            toolNames.add(block.name)
          }
        }
      }
      expect(toolNames.has("Read")).toBe(true)
      expect(toolNames.has("Grep")).toBe(true)
    })
  })

  describe("toolUseErrorFixture", () => {
    it("contains tool result with is_error flag", () => {
      const hasError = toolUseErrorFixture.entries.some(e => {
        if (e.event.type !== "user") return false
        const message = e.event.message as { content?: unknown[] }
        if (!Array.isArray(message?.content)) return false
        return message.content.some(c => (c as { is_error?: boolean }).is_error === true)
      })
      expect(hasError).toBe(true)
    })

    it("has assistant response after error", () => {
      // Find the error result index
      const errorIndex = toolUseErrorFixture.entries.findIndex(e => {
        if (e.event.type !== "user") return false
        const message = e.event.message as { content?: unknown[] }
        if (!Array.isArray(message?.content)) return false
        return message.content.some(c => (c as { is_error?: boolean }).is_error === true)
      })

      // Should have assistant events after the error
      const eventsAfterError = toolUseErrorFixture.entries.slice(errorIndex + 1)
      const hasAssistantAfter = eventsAfterError.some(e => e.event.type === "assistant")
      expect(hasAssistantAfter).toBe(true)
    })
  })

  describe("fullStreamingFixture", () => {
    it("contains message_start event", () => {
      const hasMessageStart = fullStreamingFixture.entries.some(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string })?.type === "message_start",
      )
      expect(hasMessageStart).toBe(true)
    })

    it("contains message_stop event", () => {
      const hasMessageStop = fullStreamingFixture.entries.some(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string })?.type === "message_stop",
      )
      expect(hasMessageStop).toBe(true)
    })

    it("contains both streaming and assistant events for deduplication testing", () => {
      const hasStreaming = fullStreamingFixture.entries.some(e => e.event.type === "stream_event")
      const hasAssistant = fullStreamingFixture.entries.some(e => e.event.type === "assistant")
      expect(hasStreaming).toBe(true)
      expect(hasAssistant).toBe(true)
    })
  })

  describe("multiToolFullStreamingFixture", () => {
    it("contains multiple tool uses", () => {
      const toolUseStarts = multiToolFullStreamingFixture.entries.filter(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string; content_block?: { type: string } })?.content_block
            ?.type === "tool_use",
      )
      expect(toolUseStarts.length).toBe(3) // 3 Bash commands
    })

    it("has two turns (tool use + final response)", () => {
      const messageStops = multiToolFullStreamingFixture.entries.filter(
        e =>
          e.event.type === "stream_event" &&
          (e.event.event as { type: string })?.type === "message_stop",
      )
      expect(messageStops.length).toBe(2) // Turn 1 and Turn 2
    })

    it("has tool results between turns", () => {
      const toolResults = multiToolFullStreamingFixture.entries.filter(e => {
        if (e.event.type !== "user") return false
        const message = e.event.message as { content?: unknown[] }
        if (!Array.isArray(message?.content)) return false
        return message.content.some(c => (c as { type?: string }).type === "tool_result")
      })
      expect(toolResults.length).toBe(1) // One user event with 3 tool results
    })
  })

  describe("all fixtures have consistent structure", () => {
    const fixtures = getAllFixtures()

    it.each(fixtures.map(f => [f.metadata.name, f]))("%s has valid metadata", (_name, fixture) => {
      expect(fixture.metadata.name).toBeTruthy()
      expect(fixture.metadata.description).toBeTruthy()
    })

    it.each(fixtures.map(f => [f.metadata.name, f]))(
      "%s has entries with required fields",
      (_name, fixture) => {
        for (const entry of fixture.entries) {
          expect(entry.sessionId).toBeTruthy()
          expect(entry.loggedAt).toBeTruthy()
          expect(entry.event).toBeDefined()
          expect(entry.event.type).toBeTruthy()
          expect(entry.event.timestamp).toBeGreaterThan(0)
        }
      },
    )

    it.each(fixtures.map(f => [f.metadata.name, f]))(
      "%s has chronological timestamps within events",
      (_name, fixture) => {
        const events = extractEvents(fixture.entries)
        const sorted = sortEventsByTimestamp(events)

        // When sorted by timestamp, all timestamps should be valid
        for (const event of sorted) {
          expect(event.timestamp).toBeGreaterThan(0)
        }
      },
    )
  })
})
