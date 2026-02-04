import { describe, it, expect } from "vitest"
import { renderEventContentBlock } from "@herbcaudill/agent-view"
import type { AssistantContentBlock } from "@/types"

describe("renderEventContentBlock", () => {
  const emptyToolResults = new Map()
  const timestamp = 1234567890

  describe("eventIndex key prefix", () => {
    it("includes event index prefix in key for text blocks when eventIndex is provided", () => {
      const block: AssistantContentBlock = { type: "text", text: "Hello" }

      const element = renderEventContentBlock(block, 0, timestamp, emptyToolResults, {
        eventIndex: 3,
      })

      expect(element).not.toBeNull()
      expect(element!.key).toBe("3-text-0")
    })

    it("includes event index prefix in key for thinking blocks when eventIndex is provided", () => {
      const block: AssistantContentBlock = { type: "thinking", thinking: "Let me think..." }

      const element = renderEventContentBlock(block, 0, timestamp, emptyToolResults, {
        eventIndex: 5,
      })

      expect(element).not.toBeNull()
      expect(element!.key).toBe("5-thinking-0")
    })

    it("includes event index prefix in key for tool_use blocks when eventIndex is provided", () => {
      const block: AssistantContentBlock = {
        type: "tool_use",
        id: "toolu_abc123",
        name: "Bash",
        input: { command: "ls" },
      }

      const element = renderEventContentBlock(block, 0, timestamp, emptyToolResults, {
        eventIndex: 7,
      })

      expect(element).not.toBeNull()
      expect(element!.key).toBe("7-tool-toolu_abc123")
    })

    it("does not include event index prefix when eventIndex is not provided", () => {
      const block: AssistantContentBlock = { type: "text", text: "Hello" }

      const element = renderEventContentBlock(block, 0, timestamp, emptyToolResults)

      expect(element).not.toBeNull()
      expect(element!.key).toBe("text-0")
    })

    it("two events with the same tool use block ID produce different keys with different eventIndex values", () => {
      const block: AssistantContentBlock = {
        type: "tool_use",
        id: "toolu_duplicate",
        name: "Read",
        input: { file_path: "/tmp/test.txt" },
      }

      const elementFromEvent0 = renderEventContentBlock(block, 0, timestamp, emptyToolResults, {
        eventIndex: 0,
      })
      const elementFromEvent1 = renderEventContentBlock(block, 0, timestamp, emptyToolResults, {
        eventIndex: 1,
      })

      expect(elementFromEvent0).not.toBeNull()
      expect(elementFromEvent1).not.toBeNull()
      expect(elementFromEvent0!.key).toBe("0-tool-toolu_duplicate")
      expect(elementFromEvent1!.key).toBe("1-tool-toolu_duplicate")
      expect(elementFromEvent0!.key).not.toBe(elementFromEvent1!.key)
    })

    it("two events with the same text block index produce different keys with different eventIndex values", () => {
      const block: AssistantContentBlock = { type: "text", text: "Same text content" }

      const elementFromEvent0 = renderEventContentBlock(block, 0, timestamp, emptyToolResults, {
        eventIndex: 2,
      })
      const elementFromEvent1 = renderEventContentBlock(block, 0, timestamp, emptyToolResults, {
        eventIndex: 3,
      })

      expect(elementFromEvent0).not.toBeNull()
      expect(elementFromEvent1).not.toBeNull()
      expect(elementFromEvent0!.key).toBe("2-text-0")
      expect(elementFromEvent1!.key).toBe("3-text-0")
      expect(elementFromEvent0!.key).not.toBe(elementFromEvent1!.key)
    })
  })
})
