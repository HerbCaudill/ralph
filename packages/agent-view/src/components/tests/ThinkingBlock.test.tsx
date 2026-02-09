import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ThinkingBlock } from "../ThinkingBlock"

describe("ThinkingBlock" /** Verify expand/collapse toggle and shared Button usage. */, () => {
  const content = "Some internal thinking content"

  it("renders collapsed by default with a toggle button" /** The toggle should be visible and the content hidden. */, () => {
    render(<ThinkingBlock content={content} />)

    expect(screen.getByText("Thinking...")).toBeInTheDocument()
    expect(screen.queryByText(content)).not.toBeInTheDocument()
  })

  it("expands to show content when toggle is clicked" /** Clicking the toggle should reveal the thinking content. */, () => {
    render(<ThinkingBlock content={content} />)

    fireEvent.click(screen.getByText("Thinking..."))

    expect(screen.getByText(content)).toBeInTheDocument()
  })

  it("collapses when toggle is clicked again" /** Clicking the toggle twice should hide the content again. */, () => {
    render(<ThinkingBlock content={content} />)

    fireEvent.click(screen.getByText("Thinking..."))
    expect(screen.getByText(content)).toBeInTheDocument()

    fireEvent.click(screen.getByText("Thinking..."))
    expect(screen.queryByText(content)).not.toBeInTheDocument()
  })

  it("starts expanded when defaultExpanded is true" /** The content should be visible immediately. */, () => {
    render(<ThinkingBlock content={content} defaultExpanded />)

    expect(screen.getByText(content)).toBeInTheDocument()
  })

  it("uses the shared Button component with ghost variant" /** The toggle should render using Button from @herbcaudill/components. */, () => {
    render(<ThinkingBlock content={content} />)

    const button = screen.getByRole("button")
    expect(button).toHaveAttribute("data-slot", "button")
    expect(button).toHaveAttribute("data-variant", "ghost")
  })
})
