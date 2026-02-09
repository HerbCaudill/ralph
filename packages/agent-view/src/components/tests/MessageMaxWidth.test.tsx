import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { EventList } from "../EventList"
import { AgentViewContext, DEFAULT_AGENT_VIEW_CONTEXT } from "../../context/AgentViewContext"
import type { ChatEvent } from "../../types"

/**
 * Tests to verify that EventList wraps content in a max-width container for improved readability.
 * On wide screens, text that stretches too far becomes hard to read.
 * The width constraint is set on the EventList wrapper, not on individual components.
 */
describe("EventList max-width for readability", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AgentViewContext.Provider value={DEFAULT_AGENT_VIEW_CONTEXT}>
      {children}
    </AgentViewContext.Provider>
  )

  it("wraps events in a max-width container", () => {
    const events: ChatEvent[] = [
      {
        type: "text",
        timestamp: Date.now(),
        content: "Hello world",
      },
    ]

    const { container } = render(<EventList events={events} />, { wrapper })

    // The EventList should wrap content in a div with max-w-[100ch]
    const wrapperDiv = container.firstChild as HTMLElement
    expect(wrapperDiv.className).toContain("max-w-[100ch]")
  })

  it("constrains all event types to the same max width", () => {
    const events: ChatEvent[] = [
      {
        type: "text",
        timestamp: Date.now(),
        content: "First message",
      },
      {
        type: "tool_use",
        timestamp: Date.now() + 1,
        tool: "Bash",
        input: { command: "ls" },
        status: "success",
      },
      {
        type: "text",
        timestamp: Date.now() + 2,
        content: "Second message",
      },
    ]

    const { container } = render(<EventList events={events} />, { wrapper })

    // All events should be constrained by the same parent wrapper
    const wrapperDiv = container.firstChild as HTMLElement
    expect(wrapperDiv.className).toContain("max-w-[100ch]")

    // All events should be children of the same max-width container
    expect(wrapperDiv.children.length).toBeGreaterThan(0)
  })

  it("returns null when there are no events", () => {
    const { container } = render(<EventList events={[]} />, { wrapper })
    expect(container.firstChild).toBeNull()
  })
})
