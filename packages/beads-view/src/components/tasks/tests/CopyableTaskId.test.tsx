import { render, screen, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { CopyableTaskId } from "../CopyableTaskId"

describe("CopyableTaskId", () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the display ID text", () => {
    render(<CopyableTaskId taskId="rui-4rt.5" displayId="4rt.5" />)
    expect(screen.getByText("4rt.5")).toBeInTheDocument()
  })

  it("copies the full task ID to clipboard when clicked", async () => {
    render(<CopyableTaskId taskId="rui-4rt.5" displayId="4rt.5" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy.*4rt\.5/i }))
    })

    expect(writeTextMock).toHaveBeenCalledWith("rui-4rt.5")
  })

  it("stops event propagation so parent click handlers are not triggered", async () => {
    const parentOnClick = vi.fn()
    render(
      <div onClick={parentOnClick}>
        <CopyableTaskId taskId="rui-4rt.5" displayId="4rt.5" />
      </div>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy.*4rt\.5/i }))
    })

    expect(parentOnClick).not.toHaveBeenCalled()
  })

  it("shows a checkmark icon briefly after copying", async () => {
    render(<CopyableTaskId taskId="rui-4rt.5" displayId="4rt.5" />)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy.*4rt\.5/i }))
    })

    // After clicking, should show "Copied" feedback
    expect(screen.getByLabelText("Copied")).toBeInTheDocument()

    // After the timeout, it should revert
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.queryByLabelText("Copied")).not.toBeInTheDocument()
  })

  it("has cursor-pointer and hover styling for discoverability", () => {
    render(<CopyableTaskId taskId="rui-4rt.5" displayId="4rt.5" />)
    const button = screen.getByRole("button", { name: /copy.*4rt\.5/i })
    expect(button).toHaveClass("cursor-pointer")
  })

  it("applies custom className", () => {
    render(<CopyableTaskId taskId="rui-4rt.5" displayId="4rt.5" className="custom-class" />)
    const button = screen.getByRole("button", { name: /copy.*4rt\.5/i })
    expect(button).toHaveClass("custom-class")
  })
})
