import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ErrorEvent } from "@herbcaudill/agent-view"

describe("ErrorEvent", () => {
  it("renders error event", () => {
    render(
      <ErrorEvent
        event={{
          type: "error",
          timestamp: 1234567890,
          error: "Something went wrong",
        }}
      />,
    )

    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByTestId("error-event")).toHaveAttribute("data-error-type", "error")
  })

  it("renders server_error event", () => {
    render(
      <ErrorEvent
        event={{
          type: "server_error",
          timestamp: 1234567890,
          error: "Ralph is not running",
        }}
      />,
    )

    expect(screen.getByText("Server Error")).toBeInTheDocument()
    expect(screen.getByText("Ralph is not running")).toBeInTheDocument()
    expect(screen.getByTestId("error-event")).toHaveAttribute("data-error-type", "server_error")
  })

  it("applies custom className", () => {
    render(
      <ErrorEvent
        event={{
          type: "error",
          timestamp: 1234567890,
          error: "Test error",
        }}
        className="custom-class"
      />,
    )

    expect(screen.getByTestId("error-event")).toHaveClass("custom-class")
  })

  it("renders multiline error messages", () => {
    render(
      <ErrorEvent
        event={{
          type: "error",
          timestamp: 1234567890,
          error: "Error on line 1\nError on line 2",
        }}
      />,
    )

    // Testing-library normalizes whitespace, so we use a custom matcher
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === "Error on line 1\nError on line 2"
      }),
    ).toBeInTheDocument()
  })
})
