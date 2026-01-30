import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAutoScroll } from "@herbcaudill/agent-view"

// Mock container with controllable scroll properties
function createMockContainer(scrollTop = 0, scrollHeight = 1000, clientHeight = 500) {
  return {
    scrollTop,
    scrollHeight,
    clientHeight,
  } as HTMLDivElement
}

describe("useAutoScroll", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("initialization", () => {
    it("initializes with autoScroll true", () => {
      const { result } = renderHook(() => useAutoScroll())
      expect(result.current.autoScroll).toBe(true)
    })

    it("initializes with isAtBottom true", () => {
      const { result } = renderHook(() => useAutoScroll())
      expect(result.current.isAtBottom).toBe(true)
    })

    it("provides a containerRef", () => {
      const { result } = renderHook(() => useAutoScroll())
      expect(result.current.containerRef).toBeDefined()
      expect(result.current.containerRef.current).toBeNull()
    })

    it("provides handler functions", () => {
      const { result } = renderHook(() => useAutoScroll())
      expect(typeof result.current.handleScroll).toBe("function")
      expect(typeof result.current.handleUserScroll).toBe("function")
      expect(typeof result.current.scrollToBottom).toBe("function")
    })
  })

  describe("checkIsAtBottom logic", () => {
    it("considers at bottom when within default threshold (50px)", () => {
      const { result } = renderHook(() => useAutoScroll())

      // Simulate container at bottom (scrollTop + clientHeight = scrollHeight)
      // scrollHeight - scrollTop - clientHeight <= 50
      const container = createMockContainer(450, 1000, 500) // 1000 - 450 - 500 = 50
      ;(result.current.containerRef as any).current = container

      act(() => {
        result.current.handleScroll()
      })

      expect(result.current.isAtBottom).toBe(true)
    })

    it("considers not at bottom when beyond threshold", () => {
      const { result } = renderHook(() => useAutoScroll())

      // scrollHeight - scrollTop - clientHeight > 50
      const container = createMockContainer(400, 1000, 500) // 1000 - 400 - 500 = 100
      ;(result.current.containerRef as any).current = container

      act(() => {
        result.current.handleScroll()
      })

      expect(result.current.isAtBottom).toBe(false)
    })

    it("respects custom threshold", () => {
      const { result } = renderHook(() => useAutoScroll({ threshold: 100 }))

      // With threshold 100: 1000 - 400 - 500 = 100, should be at bottom
      const container = createMockContainer(400, 1000, 500)
      ;(result.current.containerRef as any).current = container

      act(() => {
        result.current.handleScroll()
      })

      expect(result.current.isAtBottom).toBe(true)
    })
  })

  describe("handleUserScroll", () => {
    it("disables autoScroll when user scrolls away from bottom", () => {
      const { result } = renderHook(() => useAutoScroll())

      // User scrolls away from bottom
      const container = createMockContainer(200, 1000, 500) // Not at bottom
      ;(result.current.containerRef as any).current = container

      act(() => {
        result.current.handleUserScroll()
      })

      expect(result.current.autoScroll).toBe(false)
    })

    it("keeps autoScroll enabled when user is at bottom", () => {
      const { result } = renderHook(() => useAutoScroll())

      // User at bottom
      const container = createMockContainer(450, 1000, 500) // At bottom
      ;(result.current.containerRef as any).current = container

      act(() => {
        result.current.handleUserScroll()
      })

      expect(result.current.autoScroll).toBe(true)
    })
  })

  describe("handleScroll", () => {
    it("updates isAtBottom but does not re-enable autoScroll (prevents jittering)", () => {
      const { result } = renderHook(() => useAutoScroll())

      // First, disable autoScroll by scrolling away via user action
      const containerAway = createMockContainer(200, 1000, 500)
      ;(result.current.containerRef as any).current = containerAway

      act(() => {
        result.current.handleUserScroll()
      })
      expect(result.current.autoScroll).toBe(false)

      // handleScroll (fires on any scroll event including layout shifts)
      // should update isAtBottom but NOT re-enable autoScroll
      // This prevents jittering loops when content height changes
      const containerAtBottom = createMockContainer(450, 1000, 500)
      ;(result.current.containerRef as any).current = containerAtBottom

      act(() => {
        result.current.handleScroll()
      })

      expect(result.current.isAtBottom).toBe(true)
      // autoScroll should NOT be re-enabled by handleScroll
      // Only handleUserScroll (wheel/touch) or scrollToBottom should re-enable it
      expect(result.current.autoScroll).toBe(false)
    })
  })

  describe("handleUserScroll re-enables autoScroll", () => {
    it("re-enables autoScroll when user scrolls back to bottom via wheel/touch", () => {
      const { result } = renderHook(() => useAutoScroll())

      // First, disable autoScroll by scrolling away
      const containerAway = createMockContainer(200, 1000, 500)
      ;(result.current.containerRef as any).current = containerAway

      act(() => {
        result.current.handleUserScroll()
      })
      expect(result.current.autoScroll).toBe(false)

      // User scrolls back to bottom via wheel/touch
      const containerAtBottom = createMockContainer(450, 1000, 500)
      ;(result.current.containerRef as any).current = containerAtBottom

      act(() => {
        result.current.handleUserScroll()
      })

      expect(result.current.autoScroll).toBe(true)
      expect(result.current.isAtBottom).toBe(true)
    })
  })

  describe("scrollToBottom", () => {
    it("scrolls container to bottom", () => {
      const { result } = renderHook(() => useAutoScroll())

      const container = createMockContainer(0, 1000, 500)
      ;(result.current.containerRef as any).current = container

      act(() => {
        result.current.scrollToBottom()
      })

      expect(container.scrollTop).toBe(1000) // scrollHeight
    })

    it("re-enables autoScroll", () => {
      const { result } = renderHook(() => useAutoScroll())

      // First disable autoScroll
      const container = createMockContainer(200, 1000, 500)
      ;(result.current.containerRef as any).current = container

      act(() => {
        result.current.handleUserScroll()
      })
      expect(result.current.autoScroll).toBe(false)

      // Now scroll to bottom
      act(() => {
        result.current.scrollToBottom()
      })

      expect(result.current.autoScroll).toBe(true)
      expect(result.current.isAtBottom).toBe(true)
    })

    it("does nothing when containerRef is null", () => {
      const { result } = renderHook(() => useAutoScroll())

      // containerRef.current is null by default
      act(() => {
        result.current.scrollToBottom() // Should not throw
      })

      expect(result.current.autoScroll).toBe(true) // Should still be true
    })
  })

  describe("enabled option", () => {
    it("respects enabled=false option", () => {
      const { result } = renderHook(() => useAutoScroll({ enabled: false }))

      // Auto-scroll effect won't run with enabled=false
      expect(result.current.autoScroll).toBe(true) // Internal state is still true
    })
  })

  describe("dependencies option", () => {
    it("accepts dependencies array", () => {
      const deps = [1, 2, 3]
      const { result } = renderHook(() => useAutoScroll({ dependencies: deps }))

      // Just verify it doesn't throw
      expect(result.current.autoScroll).toBe(true)
    })
  })
})
