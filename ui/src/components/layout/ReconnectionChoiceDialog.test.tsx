import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ReconnectionChoiceDialog } from "./ReconnectionChoiceDialog"

describe("ReconnectionChoiceDialog", () => {
  it("renders when open is true", () => {
    render(<ReconnectionChoiceDialog open={true} />)

    expect(screen.getByTestId("reconnection-choice-dialog")).toBeInTheDocument()
    expect(screen.getByText("Connection Restored")).toBeInTheDocument()
    expect(
      screen.getByText(/The connection was lost while an iteration was in progress/),
    ).toBeInTheDocument()
  })

  it("does not render when open is false", () => {
    render(<ReconnectionChoiceDialog open={false} />)

    expect(screen.queryByTestId("reconnection-choice-dialog")).not.toBeInTheDocument()
  })

  it("shows continue option with description", () => {
    render(<ReconnectionChoiceDialog open={true} />)

    expect(screen.getByTestId("reconnection-continue-button")).toBeInTheDocument()
    expect(screen.getByText("Continue from where we left off")).toBeInTheDocument()
    expect(
      screen.getByText(/Resume the iteration with the preserved conversation context/),
    ).toBeInTheDocument()
  })

  it("shows start fresh option with description", () => {
    render(<ReconnectionChoiceDialog open={true} />)

    expect(screen.getByTestId("reconnection-start-fresh-button")).toBeInTheDocument()
    expect(screen.getByText("Start fresh")).toBeInTheDocument()
    expect(screen.getByText(/Discard any partial progress/)).toBeInTheDocument()
  })

  it("calls onContinue when continue button is clicked", () => {
    const onContinue = vi.fn()
    render(<ReconnectionChoiceDialog open={true} onContinue={onContinue} />)

    fireEvent.click(screen.getByTestId("reconnection-continue-button"))

    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it("calls onStartFresh when start fresh button is clicked", () => {
    const onStartFresh = vi.fn()
    render(<ReconnectionChoiceDialog open={true} onStartFresh={onStartFresh} />)

    fireEvent.click(screen.getByTestId("reconnection-start-fresh-button"))

    expect(onStartFresh).toHaveBeenCalledTimes(1)
  })

  it("handles missing callbacks gracefully", () => {
    render(<ReconnectionChoiceDialog open={true} />)

    // Should not throw when clicking buttons without callbacks
    expect(() => {
      fireEvent.click(screen.getByTestId("reconnection-continue-button"))
      fireEvent.click(screen.getByTestId("reconnection-start-fresh-button"))
    }).not.toThrow()
  })
})
