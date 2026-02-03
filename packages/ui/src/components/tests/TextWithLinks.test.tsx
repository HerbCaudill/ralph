import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TextWithLinks } from "../TextWithLinks"

describe("TextWithLinks", () => {
  it("renders plain text without links", () => {
    render(<TextWithLinks text="Hello world" />)
    expect(screen.getByText("Hello world")).toBeInTheDocument()
  })

  it("renders task ID as link", () => {
    render(<TextWithLinks text="See rui-123 for details" />)
    const link = screen.getByRole("link", { name: "123" })
    expect(link).toBeInTheDocument()
  })

  it("handles multiple task IDs", () => {
    render(<TextWithLinks text="rui-123 depends on r-abc12" />)
    expect(screen.getByRole("link", { name: "123" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "abc12" })).toBeInTheDocument()
  })

  it("calls onTaskClick when link clicked", () => {
    const onClick = vi.fn()
    render(<TextWithLinks text="Click rui-123" onTaskClick={onClick} />)
    fireEvent.click(screen.getByRole("link", { name: "123" }))
    expect(onClick).toHaveBeenCalledWith("rui-123")
  })
})
