import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MainLayout } from "../MainLayout"

describe("MainLayout", () => {
  describe("basic rendering", () => {
    it("renders children in the main area", () => {
      render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      expect(screen.getByText("Main content")).toBeInTheDocument()
    })

    it("renders sidebar when provided", () => {
      render(
        <MainLayout sidebar={<div>Sidebar content</div>}>
          <div>Main content</div>
        </MainLayout>,
      )
      expect(screen.getByText("Sidebar content")).toBeInTheDocument()
    })

    it("does not render sidebar when not provided", () => {
      render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      expect(screen.queryByRole("separator")).not.toBeInTheDocument()
    })

    it("renders right panel when provided", () => {
      render(
        <MainLayout rightPanel={<div>Right panel content</div>}>
          <div>Main content</div>
        </MainLayout>,
      )
      expect(screen.getByText("Right panel content")).toBeInTheDocument()
    })

    it("does not render right panel when not provided", () => {
      const { container } = render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      // Should only have main element, no aside elements
      expect(container.querySelectorAll("aside")).toHaveLength(0)
    })
  })

  describe("resizable sidebar", () => {
    it("renders resize handle when sidebar is open", () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      expect(screen.getByRole("separator", { name: /resize sidebar/i })).toBeInTheDocument()
    })

    it("has proper accessibility attributes on resize handle", () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })
      expect(resizeHandle).toHaveAttribute("aria-orientation", "vertical")
    })

    it("applies resize cursor when resizing", async () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })

      // Start resize
      fireEvent.mouseDown(resizeHandle)
      expect(document.body.style.cursor).toBe("col-resize")

      // Stop resize
      fireEvent.mouseUp(document)
      expect(document.body.style.cursor).toBe("")
    })

    it("constrains sidebar width to minimum (200px)", async () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })
      const sidebar = container.querySelector("aside")

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse below minimum (100px)
      fireEvent.mouseMove(document, { clientX: 100 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Width should be clamped to minimum
      expect(sidebar).toHaveStyle({ width: "200px" })
    })

    it("constrains sidebar width to maximum (400px)", async () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })
      const sidebar = container.querySelector("aside")

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse above maximum (500px)
      fireEvent.mouseMove(document, { clientX: 500 })

      // Stop resize
      fireEvent.mouseUp(document)

      // Width should be clamped to maximum
      expect(sidebar).toHaveStyle({ width: "400px" })
    })

    it("updates sidebar width during resize", async () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      const resizeHandle = screen.getByRole("separator", { name: /resize sidebar/i })
      const sidebar = container.querySelector("aside")

      // Start resize
      fireEvent.mouseDown(resizeHandle)

      // Move mouse to 300px
      fireEvent.mouseMove(document, { clientX: 300 })

      // Width should update
      expect(sidebar).toHaveStyle({ width: "300px" })

      // Stop resize
      fireEvent.mouseUp(document)
    })
  })

  describe("layout structure", () => {
    it("renders all three panels when provided", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      // Should have 2 aside elements (left sidebar, right panel)
      expect(container.querySelectorAll("aside")).toHaveLength(2)
      // Should have 1 main element
      expect(container.querySelectorAll("main")).toHaveLength(1)
    })

    it("uses flexbox layout", () => {
      const { container } = render(
        <MainLayout>
          <div>Main</div>
        </MainLayout>,
      )

      const layoutContainer = container.firstChild
      expect(layoutContainer).toHaveClass("flex")
    })
  })
})
