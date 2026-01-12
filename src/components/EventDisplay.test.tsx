import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect, vi } from "vitest"
import { EventDisplay } from "./EventDisplay.js"

describe("EventDisplay", () => {
  it("filters out stream_event types and only shows assistant messages", async () => {
    const events = [
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Streaming..." },
        },
      },
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "text", text: "Complete message" }],
        },
      },
    ]

    const { lastFrame } = render(<EventDisplay events={events} />)

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Complete message")
      // Should not show streaming events
      expect(output).not.toContain("Streaming...")
    })
  })

  it("deduplicates events with the same message ID", async () => {
    const events = [
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "text", text: "First version" }],
        },
      },
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [
            { type: "text", text: "First version" },
            { type: "text", text: "Updated version" },
          ],
        },
      },
    ]

    const { lastFrame } = render(<EventDisplay events={events} />)

    // Wait for useEffect to complete
    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Updated version")
    })

    const output = lastFrame() ?? ""
    // Should not duplicate the first text
    expect(output.match(/First version/g)?.length).toBe(1)
  })

  it("handles multiple different messages", async () => {
    const events = [
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "text", text: "Message 1" }],
        },
      },
      {
        type: "assistant",
        message: {
          id: "msg_456",
          content: [{ type: "text", text: "Message 2" }],
        },
      },
    ]

    const { lastFrame } = render(<EventDisplay events={events} />)

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Message 1")
      expect(output).toContain("Message 2")
    })
  })

  it("handles tool use events", async () => {
    const events = [
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [
            {
              type: "tool_use",
              name: "Read",
              input: { file_path: "/absolute/path/file.ts" },
            },
          ],
        },
      },
    ]

    const { lastFrame } = render(<EventDisplay events={events} />)

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Read")
      expect(output).toContain("file.ts")
    })
  })

  it("updates display when new events arrive", async () => {
    const events1 = [
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "text", text: "Initial" }],
        },
      },
    ]

    const { lastFrame, rerender } = render(<EventDisplay events={events1} />)

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Initial")
    })

    const events2 = [
      ...events1,
      {
        type: "assistant",
        message: {
          id: "msg_456",
          content: [{ type: "text", text: "New message" }],
        },
      },
    ]

    rerender(<EventDisplay events={events2} />)

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Initial")
      expect(output).toContain("New message")
    })
  })

  it("handles partial message updates without duplicating keys", async () => {
    // Simulate streaming where the same message gets updated multiple times
    const events = [
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "text", text: "Thinking..." }],
        },
      },
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [
            { type: "text", text: "Thinking..." },
            {
              type: "tool_use",
              name: "Read",
              input: { file_path: "/path/file.ts" },
            },
          ],
        },
      },
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [
            { type: "text", text: "Thinking..." },
            {
              type: "tool_use",
              name: "Read",
              input: { file_path: "/path/file.ts" },
            },
            {
              type: "tool_use",
              name: "Edit",
              input: { file_path: "/path/file.ts" },
            },
          ],
        },
      },
    ]

    const { lastFrame } = render(<EventDisplay events={events} />)

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      // Should only see one instance of each tool
      expect(output.match(/Read/g)?.length).toBe(1)
      expect(output.match(/Edit/g)?.length).toBe(1)
    })
  })
})
