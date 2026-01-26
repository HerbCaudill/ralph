import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect, vi } from "vitest"
import { EventDisplay } from "./EventDisplay.js"

/**
 * Test suite for EventDisplay component
 */
describe("EventDisplay", () => {
  /**
   * Verify that stream_event types are filtered out and only assistant messages are displayed
   */
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

    const { lastFrame } = render(
      <EventDisplay events={events} session={1} completedSessions={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Complete message")
      // Should not show streaming events
      expect(output).not.toContain("Streaming...")
    })
  })

  /**
   * Verify that events with the same message ID are deduplicated, keeping only the latest version
   */
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

    const { lastFrame } = render(
      <EventDisplay events={events} session={1} completedSessions={[]} />,
    )

    // Wait for useEffect to complete
    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Updated version")
    })

    const output = lastFrame() ?? ""
    // Should not duplicate the first text
    expect(output.match(/First version/g)?.length).toBe(1)
  })

  /**
   * Verify that multiple different messages are all displayed correctly
   */
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

    const { lastFrame } = render(
      <EventDisplay events={events} session={1} completedSessions={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Message 1")
      expect(output).toContain("Message 2")
    })
  })

  /**
   * Verify that tool use events are displayed correctly with tool names and file paths
   */
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

    const { lastFrame } = render(
      <EventDisplay events={events} session={1} completedSessions={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Read")
      expect(output).toContain("file.ts")
    })
  })

  /**
   * Verify that the display updates correctly when new events are added to the event list
   */
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

    const { lastFrame, rerender } = render(
      <EventDisplay events={events1} session={1} completedSessions={[]} />,
    )

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

    rerender(<EventDisplay events={events2} session={1} completedSessions={[]} />)

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Initial")
      expect(output).toContain("New message")
    })
  })

  /**
   * Verify that partial message updates during streaming don't create duplicate React keys
   */
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
              id: "toolu_read1",
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
              id: "toolu_read1",
              name: "Read",
              input: { file_path: "/path/file.ts" },
            },
            {
              type: "tool_use",
              id: "toolu_edit1",
              name: "Edit",
              input: { file_path: "/path/file.ts" },
            },
          ],
        },
      },
    ]

    const { lastFrame } = render(
      <EventDisplay events={events} session={1} completedSessions={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      // Should only see one instance of each tool
      expect(output.match(/Read/g)?.length).toBe(1)
      expect(output.match(/Edit/g)?.length).toBe(1)
    })
  })

  /**
   * Verify that consecutive text blocks are merged to prevent unwanted gaps in the output
   */
  it("merges consecutive text blocks to prevent unwanted gaps", async () => {
    // When Claude outputs text in multiple blocks (e.g., before and after inline code),
    // we should merge them into one StreamingText component to avoid gaps
    const events = [
      {
        type: "assistant",
        message: {
          id: "msg_123",
          content: [
            { type: "text", text: "Use the " },
            { type: "text", text: "`console.log()`" },
            { type: "text", text: " function to debug." },
          ],
        },
      },
    ]

    const { lastFrame } = render(
      <EventDisplay events={events} session={1} completedSessions={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Use the")
      expect(output).toContain("console.log()")
      expect(output).toContain("function to debug")
    })

    // The text content should be on one line (after the header)
    const output = lastFrame() ?? ""
    // Filter out header lines (containing box border characters or "Round")
    const contentLines = output
      .split("\n")
      .filter(l => l.trim())
      .filter(l => !l.includes("─") && !l.includes("│") && !l.includes("╭") && !l.includes("╰"))
    expect(contentLines.length).toBe(1)
  })

  /**
   * Verify that completed session rounds are displayed before the current round
   */
  it("displays completed rounds before current round", async () => {
    const completedSessions = [
      {
        session: 1,
        events: [
          {
            type: "assistant",
            message: {
              id: "msg_iter1",
              content: [{ type: "text", text: "First round work" }],
            },
          },
        ],
      },
      {
        session: 2,
        events: [
          {
            type: "assistant",
            message: {
              id: "msg_iter2",
              content: [{ type: "text", text: "Second round work" }],
            },
          },
        ],
      },
    ]

    const currentEvents = [
      {
        type: "assistant",
        message: {
          id: "msg_iter3",
          content: [{ type: "text", text: "Third round work" }],
        },
      },
    ]

    const { lastFrame } = render(
      <EventDisplay events={currentEvents} session={3} completedSessions={completedSessions} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      // Should show all 3 rounds
      expect(output).toContain("Round 1")
      expect(output).toContain("First round work")
      expect(output).toContain("Round 2")
      expect(output).toContain("Second round work")
      expect(output).toContain("Round 3")
      expect(output).toContain("Third round work")
    })

    // Verify order: round 1 before 2, round 2 before 3
    const output = lastFrame() ?? ""
    const iter1Pos = output.indexOf("Round 1")
    const iter2Pos = output.indexOf("Round 2")
    const iter3Pos = output.indexOf("Round 3")
    expect(iter1Pos).toBeLessThan(iter2Pos)
    expect(iter2Pos).toBeLessThan(iter3Pos)
  })

  /**
   * Verify that round headers are shown correctly when transitioning from one round to the next
   */
  it("shows new round header when transitioning between rounds", async () => {
    // Start with round 1
    const iter1Events = [
      {
        type: "assistant",
        message: {
          id: "msg_iter1",
          content: [{ type: "text", text: "First round" }],
        },
      },
    ]

    const { lastFrame, rerender } = render(
      <EventDisplay events={iter1Events} session={1} completedSessions={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Round 1")
      expect(output).toContain("First round")
    })

    // Transition to round 2 (round 1 moves to completedSessions)
    const iter2Events = [
      {
        type: "assistant",
        message: {
          id: "msg_iter2",
          content: [{ type: "text", text: "Second round" }],
        },
      },
    ]

    rerender(
      <EventDisplay
        events={iter2Events}
        session={2}
        completedSessions={[{ session: 1, events: iter1Events }]}
      />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      // Should show both rounds
      expect(output).toContain("Round 1")
      expect(output).toContain("First round")
      expect(output).toContain("Round 2")
      expect(output).toContain("Second round")
    })
  })
})
