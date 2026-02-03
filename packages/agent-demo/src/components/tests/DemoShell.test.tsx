import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { DemoShell } from "../DemoShell"

describe("DemoShell", () => {
  it("renders the title", () => {
    render(<DemoShell title="Test Title">Content</DemoShell>)
    expect(screen.getByRole("heading", { name: "Test Title" })).toBeInTheDocument()
  })

  it("renders children in main content area", () => {
    render(<DemoShell title="Test">Main content here</DemoShell>)
    expect(screen.getByText("Main content here")).toBeInTheDocument()
  })

  it("renders subtitle when provided", () => {
    render(
      <DemoShell title="Test" subtitle="A subtitle">
        Content
      </DemoShell>,
    )
    expect(screen.getByText("A subtitle")).toBeInTheDocument()
  })

  it("renders header actions when provided", () => {
    render(
      <DemoShell title="Test" headerActions={<button>Action</button>}>
        Content
      </DemoShell>,
    )
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument()
  })

  it("renders sidebar when provided", () => {
    render(
      <DemoShell title="Test" sidebar={<div>Sidebar content</div>}>
        Content
      </DemoShell>,
    )
    expect(screen.getByText("Sidebar content")).toBeInTheDocument()
  })

  describe("footer padding", () => {
    it("footer element does not have horizontal padding (padding is internal to sections)", () => {
      render(
        <DemoShell title="Test" statusBar={<div>Status</div>}>
          Content
        </DemoShell>,
      )
      const footer = screen.getByRole("contentinfo")
      // Footer should not have px-4 class - padding should be internal to allow dividers to fill height
      expect(footer.className).not.toContain("px-4")
    })
  })
})
