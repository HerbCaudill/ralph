import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PromiseCompleteEvent } from "../PromiseCompleteEvent"
import type { PromiseCompleteChatEvent } from "@herbcaudill/agent-view"

describe("PromiseCompleteEvent", () => {
  const event: PromiseCompleteChatEvent = {
    type: "promise_complete",
    timestamp: Date.now(),
  }

  it("renders the session complete label", () => {
    render(<PromiseCompleteEvent event={event} />)
    expect(screen.getByText("Session complete")).toBeInTheDocument()
  })

  it("renders the description text", () => {
    render(<PromiseCompleteEvent event={event} />)
    expect(screen.getByText("All tasks finished — no remaining work")).toBeInTheDocument()
  })

  it("has the correct test id", () => {
    render(<PromiseCompleteEvent event={event} />)
    expect(screen.getByTestId("promise-complete-event")).toBeInTheDocument()
  })

  it("uses purple styling", () => {
    render(<PromiseCompleteEvent event={event} />)
    const element = screen.getByTestId("promise-complete-event")
    expect(element).toHaveClass("border-purple-500")
  })
})
