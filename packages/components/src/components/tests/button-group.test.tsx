import { render, screen, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ButtonGroup } from "../button-group"

/** Tracks ResizeObserver instances for manual triggering in tests. */
let resizeObserverCallback: ResizeObserverCallback | null = null
let observedElements: Element[] = []

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback
  }
  observe(el: Element) {
    observedElements.push(el)
  }
  unobserve() {}
  disconnect() {
    resizeObserverCallback = null
    observedElements = []
  }
}

beforeEach(() => {
  resizeObserverCallback = null
  observedElements = []
  vi.stubGlobal("ResizeObserver", MockResizeObserver)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ButtonGroup", () => {
  describe("non-responsive mode", () => {
    it("renders a group role div", () => {
      render(<ButtonGroup data-testid="bg">Hello</ButtonGroup>)
      const el = screen.getByTestId("bg")
      expect(el).toHaveAttribute("role", "group")
      expect(el).toHaveAttribute("data-slot", "button-group")
    })

    it("passes className to the group element", () => {
      render(
        <ButtonGroup data-testid="bg" className="my-custom-class">
          Hello
        </ButtonGroup>,
      )
      const el = screen.getByTestId("bg")
      expect(el.className).toContain("my-custom-class")
    })

    it("does not create a ResizeObserver", () => {
      render(<ButtonGroup>Hello</ButtonGroup>)
      expect(resizeObserverCallback).toBeNull()
    })

    it("does not wrap content in an outer container div", () => {
      render(<ButtonGroup data-testid="bg">Hello</ButtonGroup>)
      const el = screen.getByTestId("bg")
      // In non-responsive mode, the group div should be the direct container
      // with no wrapper parent that has overflow-hidden
      expect(el.parentElement).not.toHaveClass("overflow-hidden")
    })

    it("forwards data-orientation attribute", () => {
      render(
        <ButtonGroup data-testid="bg" orientation="vertical">
          Hello
        </ButtonGroup>,
      )
      expect(screen.getByTestId("bg")).toHaveAttribute("data-orientation", "vertical")
    })
  })

  describe("responsive mode", () => {
    it("renders a group role div inside a wrapper", () => {
      render(
        <ButtonGroup responsive data-testid="bg">
          Hello
        </ButtonGroup>,
      )
      const el = screen.getByTestId("bg")
      expect(el).toHaveAttribute("role", "group")
      expect(el).toHaveAttribute("data-slot", "button-group")
    })

    it("wraps content in a container div with overflow-hidden", () => {
      render(
        <ButtonGroup responsive data-testid="bg">
          Hello
        </ButtonGroup>,
      )
      const el = screen.getByTestId("bg")
      const wrapper = el.parentElement!
      expect(wrapper.className).toContain("overflow-hidden")
      expect(wrapper.className).toContain("min-w-0")
    })

    it("creates a ResizeObserver", () => {
      render(
        <ButtonGroup responsive>
          <button>Test</button>
        </ButtonGroup>,
      )
      expect(resizeObserverCallback).not.toBeNull()
    })

    it("observes the wrapper container element", () => {
      render(
        <ButtonGroup responsive data-testid="bg">
          <button>Test</button>
        </ButtonGroup>,
      )
      expect(observedElements.length).toBe(1)
      const el = screen.getByTestId("bg")
      expect(observedElements[0]).toBe(el.parentElement)
    })

    it("adds collapsed class when content overflows", () => {
      render(
        <ButtonGroup responsive data-testid="bg">
          <button>
            <span data-label>Label</span>
          </button>
        </ButtonGroup>,
      )

      const el = screen.getByTestId("bg")
      const wrapper = el.parentElement!

      // Simulate overflow: scrollWidth > clientWidth
      Object.defineProperty(wrapper, "scrollWidth", { value: 500, configurable: true })
      Object.defineProperty(wrapper, "clientWidth", { value: 300, configurable: true })

      // Trigger ResizeObserver
      act(() => {
        resizeObserverCallback?.([] as any, {} as any)
      })

      // After collapse, the group div should have the collapsed style class
      expect(el.className).toContain("[data-label]")
    })

    it("removes collapsed class when container grows large enough", () => {
      render(
        <ButtonGroup responsive data-testid="bg">
          <button>
            <span data-label>Label</span>
          </button>
        </ButtonGroup>,
      )

      const el = screen.getByTestId("bg")
      const wrapper = el.parentElement!

      // First: trigger a collapse
      Object.defineProperty(wrapper, "scrollWidth", { value: 500, configurable: true })
      Object.defineProperty(wrapper, "clientWidth", { value: 300, configurable: true })

      act(() => {
        resizeObserverCallback?.([] as any, {} as any)
      })

      expect(el.className).toContain("[data-label]")

      // Now: simulate the container growing large enough
      Object.defineProperty(wrapper, "clientWidth", { value: 600, configurable: true })

      act(() => {
        resizeObserverCallback?.([] as any, {} as any)
      })

      expect(el.className).not.toContain("[data-label]")
    })

    it("applies height class based on size prop", () => {
      const { rerender } = render(
        <ButtonGroup responsive data-testid="bg">
          Hello
        </ButtonGroup>,
      )
      expect(screen.getByTestId("bg").className).toContain("h-8")

      rerender(
        <ButtonGroup responsive size="sm" data-testid="bg">
          Hello
        </ButtonGroup>,
      )
      expect(screen.getByTestId("bg").className).toContain("h-6")
    })

    it("applies bg-background and overflow-hidden to the group element", () => {
      render(
        <ButtonGroup responsive data-testid="bg">
          Hello
        </ButtonGroup>,
      )
      const el = screen.getByTestId("bg")
      expect(el.className).toContain("bg-background")
      expect(el.className).toContain("overflow-hidden")
    })

    it("disconnects ResizeObserver on unmount", () => {
      const { unmount } = render(
        <ButtonGroup responsive>
          <button>Test</button>
        </ButtonGroup>,
      )

      expect(resizeObserverCallback).not.toBeNull()
      unmount()
      expect(resizeObserverCallback).toBeNull()
    })

    it("forwards className to the group element", () => {
      render(
        <ButtonGroup responsive data-testid="bg" className="custom-class">
          Hello
        </ButtonGroup>,
      )
      const el = screen.getByTestId("bg")
      expect(el.className).toContain("custom-class")
    })
  })

  describe("no separate ResponsiveButtonGroup export", () => {
    it("ButtonGroup is a single component that handles both modes", async () => {
      // This test verifies the refactor: there should be no separate
      // ResponsiveButtonGroup function exported from the module
      const mod = await import("../button-group")
      expect(mod.ButtonGroup).toBeDefined()
      expect((mod as Record<string, unknown>).ResponsiveButtonGroup).toBeUndefined()
    })
  })
})
