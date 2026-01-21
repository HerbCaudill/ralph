import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { EventStreamEventItem } from "./EventStreamEventItem"

describe("EventStreamEventItem", () => {
  describe("error events", () => {
    it("renders error events with type 'error'", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "error",
            timestamp: 1234567890,
            error: "Something went wrong",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("error-event")).toBeInTheDocument()
      expect(screen.getByText("Something went wrong")).toBeInTheDocument()
      expect(screen.getByText("Error")).toBeInTheDocument()
    })

    it("renders error events with type 'server_error'", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "server_error",
            timestamp: 1234567890,
            error: "Ralph is not running",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByTestId("error-event")).toBeInTheDocument()
      expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
      expect(screen.getByText("Server Error")).toBeInTheDocument()
    })

    it("does not render events without error string", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "error",
            timestamp: 1234567890,
            // Missing error field
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.queryByTestId("error-event")).not.toBeInTheDocument()
    })
  })

  describe("user message events", () => {
    it("renders user message events", () => {
      render(
        <EventStreamEventItem
          event={{
            type: "user_message",
            timestamp: 1234567890,
            message: "Hello, world!",
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(screen.getByText("Hello, world!")).toBeInTheDocument()
    })
  })

  describe("unrecognized events", () => {
    it("returns null for unrecognized event types", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "unknown_type",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })

    it("returns null for stream_event type", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "stream_event",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })

    it("returns null for system event type", () => {
      const { container } = render(
        <EventStreamEventItem
          event={{
            type: "system",
            timestamp: 1234567890,
          }}
          toolResults={new Map()}
          hasStructuredLifecycleEvents={false}
        />,
      )

      expect(container.firstChild).toBeNull()
    })
  })
})
