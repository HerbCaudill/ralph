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
      render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      // When only main content is provided, there should be no resize handles
      expect(screen.queryByTestId("sidebar-resize-handle")).not.toBeInTheDocument()
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
      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main content</div>
        </MainLayout>,
      )
      // When sidebar is provided but not right panel, there should be only sidebar resize handle
      expect(screen.getByTestId("sidebar-resize-handle")).toBeInTheDocument()
      expect(screen.queryByTestId("right-panel-resize-handle")).not.toBeInTheDocument()
    })
  })

  describe("resizable panels", () => {
    it("renders resize handle between sidebar and main when sidebar is provided", () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      expect(screen.getByTestId("sidebar-resize-handle")).toBeInTheDocument()
    })

    it("renders resize handle between main and right panel when right panel is provided", () => {
      render(
        <MainLayout rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      expect(screen.getByTestId("right-panel-resize-handle")).toBeInTheDocument()
    })

    it("renders two resize handles when both sidebar and right panel are provided", () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      expect(screen.getByTestId("sidebar-resize-handle")).toBeInTheDocument()
      expect(screen.getByTestId("right-panel-resize-handle")).toBeInTheDocument()
    })

    it("resize handles have proper cursor styling", () => {
      render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )
      expect(screen.getByTestId("sidebar-resize-handle")).toHaveClass("cursor-col-resize")
      expect(screen.getByTestId("right-panel-resize-handle")).toHaveClass("cursor-col-resize")
    })
  })

  describe("accent border", () => {
    it("has a 2px solid border using the accent color CSS variable", () => {
      const { container } = render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      const layoutContainer = container.firstChild as HTMLElement
      expect(layoutContainer.style.border).toBe("2px solid var(--repo-accent)")
    })

    it("has rounded bottom corners", () => {
      const { container } = render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      const layoutContainer = container.firstChild as HTMLElement
      expect(layoutContainer).toHaveClass("rounded-bl-[10px]")
      expect(layoutContainer).toHaveClass("rounded-br-[10px]")
    })

    it("does not have rounded top corners", () => {
      const { container } = render(
        <MainLayout>
          <div>Main content</div>
        </MainLayout>,
      )
      const layoutContainer = container.firstChild as HTMLElement
      expect(layoutContainer).not.toHaveClass("rounded-tl-[10px]")
      expect(layoutContainer).not.toHaveClass("rounded-tr-[10px]")
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

    it("uses flexbox layout with proper structure", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      // Layout uses a flex container
      const layoutContainer = container.firstChild as HTMLElement
      expect(layoutContainer).toHaveClass("flex")
    })

    it("renders sidebar in aside element and main in main element", () => {
      const { container } = render(
        <MainLayout sidebar={<div>Sidebar</div>} rightPanel={<div>Right panel</div>}>
          <div>Main</div>
        </MainLayout>,
      )

      // Sidebar should be in aside, main content in main
      const asides = container.querySelectorAll("aside")
      expect(asides.length).toBe(2) // sidebar and right panel
      expect(container.querySelector("main")).toBeInTheDocument()
    })
  })
})
