import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
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
      const { container } = render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      // When only main content is provided, there should be only one panel and no separators
      const separators = container.querySelectorAll("[data-separator]")
      expect(separators.length).toBe(0)
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
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main content</div>
        </MainLayout>,
      )
      // When sidebar is provided but not right panel, there should be only one separator
      const separators = container.querySelectorAll("[data-separator]")
      expect(separators.length).toBe(1)
    })
  })

  describe("resizable panels", () => {
    it("renders resize handle (separator) between sidebar and main when sidebar is provided", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      // Separators have role="separator" and data-separator attribute
      const separators = container.querySelectorAll('[role="separator"]')
      expect(separators.length).toBe(1)
    })

    it("renders resize handle between main and right panel when right panel is provided", () => {
      const { container } = render(
        <MainLayout rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      // Should have one separator for the right panel
      const separators = container.querySelectorAll('[role="separator"]')
      expect(separators.length).toBe(1)
    })

    it("renders two resize handles when both sidebar and right panel are provided", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      // Should have two separators: one for sidebar, one for right panel
      const separators = container.querySelectorAll('[role="separator"]')
      expect(separators.length).toBe(2)
    })

    it("resize handles have proper cursor styling", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      const separators = container.querySelectorAll('[role="separator"]')
      expect(separators.length).toBe(2)

      separators.forEach(separator => {
        expect(separator).toHaveClass("cursor-col-resize")
      })
    })
  })

  describe("layout structure", () => {
    it("renders all three panels when provided", () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      expect(screen.getByText("Sidebar")).toBeInTheDocument()
      expect(screen.getByText("Main")).toBeInTheDocument()
      expect(screen.getByText("Right panel")).toBeInTheDocument()
    })

    it("uses react-resizable-panels Group", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      // Group renders a div with data-group attribute
      expect(container.querySelector("[data-group]")).toBeInTheDocument()
    })

    it("panels have proper data attributes from react-resizable-panels", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      // Panels should have data-panel attribute
      const panels = container.querySelectorAll("[data-panel]")
      expect(panels.length).toBe(3) // sidebar, main, right panel
    })
  })
})
