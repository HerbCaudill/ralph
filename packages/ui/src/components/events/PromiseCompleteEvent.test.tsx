import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PromiseCompleteEvent } from "./PromiseCompleteEvent"
import { parsePromiseCompleteEvent } from "@/lib/parsePromiseCompleteEvent"

describe("parsePromiseCompleteEvent", () => {
  it("parses <promise>COMPLETE</promise> tag", () => {
    const text = "<promise>COMPLETE</promise>"
    const result = parsePromiseCompleteEvent(text, 1234567890)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp: 1234567890,
    })
  })

  it("parses tag within surrounding text", () => {
    const text = "Some text before <promise>COMPLETE</promise> and after"
    const result = parsePromiseCompleteEvent(text, 1234567890)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp: 1234567890,
    })
  })

  it("parses tag case-insensitively", () => {
    const text = "<promise>complete</promise>"
    const result = parsePromiseCompleteEvent(text, 1234567890)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp: 1234567890,
    })
  })

  it("parses tag with whitespace around it", () => {
    const text = "  <promise>COMPLETE</promise>  "
    const result = parsePromiseCompleteEvent(text, 1234567890)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp: 1234567890,
    })
  })

  it("parses tag in multi-line text", () => {
    const text = "Some text\n<promise>COMPLETE</promise>\nMore content"
    const result = parsePromiseCompleteEvent(text, 1234567890)

    expect(result).toEqual({
      type: "promise_complete",
      timestamp: 1234567890,
    })
  })

  describe("non-matching text", () => {
    it("returns null for regular text", () => {
      const result = parsePromiseCompleteEvent("Hello world", 1234567890)
      expect(result).toBeNull()
    })

    it("returns null for partial matches", () => {
      expect(parsePromiseCompleteEvent("<promise>COMPLETE", 1234567890)).toBeNull()
      expect(parsePromiseCompleteEvent("COMPLETE</promise>", 1234567890)).toBeNull()
      expect(parsePromiseCompleteEvent("<promise></promise>", 1234567890)).toBeNull()
    })

    it("returns null for different promise content", () => {
      expect(parsePromiseCompleteEvent("<promise>PENDING</promise>", 1234567890)).toBeNull()
      expect(parsePromiseCompleteEvent("<promise>DONE</promise>", 1234567890)).toBeNull()
    })
  })
})

describe("PromiseCompleteEvent", () => {
  it("renders session complete message", () => {
    render(
      <PromiseCompleteEvent
        event={{
          type: "promise_complete",
          timestamp: 1234567890,
        }}
      />,
    )

    expect(screen.getByText("Session Complete")).toBeInTheDocument()
    expect(screen.getByTestId("promise-complete-event")).toBeInTheDocument()
  })

  it("renders descriptive text", () => {
    render(
      <PromiseCompleteEvent
        event={{
          type: "promise_complete",
          timestamp: 1234567890,
        }}
      />,
    )

    expect(screen.getByText(/no remaining work/i)).toBeInTheDocument()
  })

  it("applies custom className", () => {
    render(
      <PromiseCompleteEvent
        event={{
          type: "promise_complete",
          timestamp: 1234567890,
        }}
        className="custom-class"
      />,
    )

    expect(screen.getByTestId("promise-complete-event")).toHaveClass("custom-class")
  })
})
