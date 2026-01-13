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

    const { lastFrame } = render(
      <EventDisplay events={events} iteration={1} completedIterations={[]} />,
    )

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

    const { lastFrame } = render(
      <EventDisplay events={events} iteration={1} completedIterations={[]} />,
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
      <EventDisplay events={events} iteration={1} completedIterations={[]} />,
    )

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

    const { lastFrame } = render(
      <EventDisplay events={events} iteration={1} completedIterations={[]} />,
    )

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

    const { lastFrame, rerender } = render(
      <EventDisplay events={events1} iteration={1} completedIterations={[]} />,
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

    rerender(<EventDisplay events={events2} iteration={1} completedIterations={[]} />)

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
      <EventDisplay events={events} iteration={1} completedIterations={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      // Should only see one instance of each tool
      expect(output.match(/Read/g)?.length).toBe(1)
      expect(output.match(/Edit/g)?.length).toBe(1)
    })
  })

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
      <EventDisplay events={events} iteration={1} completedIterations={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Use the")
      expect(output).toContain("console.log()")
      expect(output).toContain("function to debug")
    })

    // The text content should be on one line (after the header)
    const output = lastFrame() ?? ""
    // Filter out header lines (containing box border characters or "Iteration")
    const contentLines = output
      .split("\n")
      .filter(l => l.trim())
      .filter(l => !l.includes("─") && !l.includes("│") && !l.includes("╭") && !l.includes("╰"))
    expect(contentLines.length).toBe(1)
  })

  it("displays completed iterations before current iteration", async () => {
    const completedIterations = [
      {
        iteration: 1,
        events: [
          {
            type: "assistant",
            message: {
              id: "msg_iter1",
              content: [{ type: "text", text: "First iteration work" }],
            },
          },
        ],
      },
      {
        iteration: 2,
        events: [
          {
            type: "assistant",
            message: {
              id: "msg_iter2",
              content: [{ type: "text", text: "Second iteration work" }],
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
          content: [{ type: "text", text: "Third iteration work" }],
        },
      },
    ]

    const { lastFrame } = render(
      <EventDisplay
        events={currentEvents}
        iteration={3}
        completedIterations={completedIterations}
      />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      // Should show all 3 iterations
      expect(output).toContain("Iteration 1")
      expect(output).toContain("First iteration work")
      expect(output).toContain("Iteration 2")
      expect(output).toContain("Second iteration work")
      expect(output).toContain("Iteration 3")
      expect(output).toContain("Third iteration work")
    })

    // Verify order: iteration 1 before 2, iteration 2 before 3
    const output = lastFrame() ?? ""
    const iter1Pos = output.indexOf("Iteration 1")
    const iter2Pos = output.indexOf("Iteration 2")
    const iter3Pos = output.indexOf("Iteration 3")
    expect(iter1Pos).toBeLessThan(iter2Pos)
    expect(iter2Pos).toBeLessThan(iter3Pos)
  })

  it("shows new iteration header when transitioning between iterations", async () => {
    // Start with iteration 1
    const iter1Events = [
      {
        type: "assistant",
        message: {
          id: "msg_iter1",
          content: [{ type: "text", text: "First iteration" }],
        },
      },
    ]

    const { lastFrame, rerender } = render(
      <EventDisplay events={iter1Events} iteration={1} completedIterations={[]} />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      expect(output).toContain("Iteration 1")
      expect(output).toContain("First iteration")
    })

    // Transition to iteration 2 (iteration 1 moves to completedIterations)
    const iter2Events = [
      {
        type: "assistant",
        message: {
          id: "msg_iter2",
          content: [{ type: "text", text: "Second iteration" }],
        },
      },
    ]

    rerender(
      <EventDisplay
        events={iter2Events}
        iteration={2}
        completedIterations={[{ iteration: 1, events: iter1Events }]}
      />,
    )

    await vi.waitFor(() => {
      const output = lastFrame() ?? ""
      // Should show both iterations
      expect(output).toContain("Iteration 1")
      expect(output).toContain("First iteration")
      expect(output).toContain("Iteration 2")
      expect(output).toContain("Second iteration")
    })
  })
})
