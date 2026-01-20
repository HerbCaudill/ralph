import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useHotkeys } from "./useHotkeys"

// Mock the navigator.platform for testing
const mockNavigator = (platform: string) => {
  Object.defineProperty(navigator, "platform", {
    value: platform,
    writable: true,
    configurable: true,
  })
}

describe("useHotkeys", () => {
  let originalPlatform: string

  beforeEach(() => {
    originalPlatform = navigator.platform
    // Default to Mac for consistent tests
    mockNavigator("MacIntel")
  })

  afterEach(() => {
    mockNavigator(originalPlatform)
    vi.restoreAllMocks()
  })

  describe("getHotkeyDisplay", () => {
    it("returns display string for hotkey on Mac", () => {
      mockNavigator("MacIntel")
      const { result } = renderHook(() =>
        useHotkeys({
          handlers: {},
        }),
      )

      // Cmd+Enter should display as the Mac command symbol + return symbol
      const display = result.current.getHotkeyDisplay("agentStart")
      expect(display).toContain("\u2318") // Mac command symbol
      expect(display).toContain("\u23CE") // Return symbol
    })

    it("returns display string for hotkey on Windows", () => {
      mockNavigator("Win32")
      const { result } = renderHook(() =>
        useHotkeys({
          handlers: {},
        }),
      )

      // Cmd+Enter should display as Ctrl+Enter on Windows
      const display = result.current.getHotkeyDisplay("agentStart")
      expect(display).toContain("Ctrl")
    })

    it("returns empty string for unknown action", () => {
      const { result } = renderHook(() =>
        useHotkeys({
          handlers: {},
        }),
      )

      // @ts-expect-error - Testing invalid action
      const display = result.current.getHotkeyDisplay("unknownAction")
      expect(display).toBe("")
    })
  })

  describe("registeredHotkeys", () => {
    it("returns all registered hotkeys with display strings and descriptions", () => {
      const { result } = renderHook(() =>
        useHotkeys({
          handlers: {},
        }),
      )

      expect(result.current.registeredHotkeys.length).toBeGreaterThan(0)

      // Check that each hotkey has required properties
      result.current.registeredHotkeys.forEach(hotkey => {
        expect(hotkey.action).toBeDefined()
        expect(hotkey.display).toBeDefined()
        expect(hotkey.description).toBeDefined()
        expect(typeof hotkey.action).toBe("string")
        expect(typeof hotkey.display).toBe("string")
        expect(typeof hotkey.description).toBe("string")
      })
    })

    it("includes all expected hotkey actions", () => {
      const { result } = renderHook(() =>
        useHotkeys({
          handlers: {},
        }),
      )

      const actions = result.current.registeredHotkeys.map(h => h.action)
      expect(actions).toContain("agentStart")
      expect(actions).toContain("agentStop")
      expect(actions).toContain("toggleSidebar")
      expect(actions).toContain("focusChatInput")
      expect(actions).toContain("cycleTheme")
      expect(actions).toContain("toggleTaskChat")
      expect(actions).toContain("focusTaskChatInput")
    })
  })

  describe("keyboard event handling", () => {
    it("calls handler when matching hotkey is pressed on Mac", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStart: handler,
          },
        }),
      )

      // Simulate Cmd+Enter on Mac
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true, // Cmd on Mac
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("calls handler when matching hotkey is pressed on Windows", () => {
      mockNavigator("Win32")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStart: handler,
          },
        }),
      )

      // Simulate Ctrl+Enter on Windows
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true, // Ctrl on Windows = Cmd equivalent
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("does not call handler when wrong modifiers are pressed", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStart: handler,
          },
        }),
      )

      // Simulate just Enter without Cmd
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: false,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it("does not call handler when hotkeys are disabled", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStart: handler,
          },
          enabled: false,
        }),
      )

      // Simulate Cmd+Enter
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it("handles toggleSidebar hotkey (Cmd+B)", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            toggleSidebar: handler,
          },
        }),
      )

      // Simulate Cmd+B
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "b",
          metaKey: true,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("handles agentStop hotkey (Cmd+.)", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStop: handler,
          },
        }),
      )

      // Simulate Cmd+.
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: ".",
          metaKey: true,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("handles shift modifier for agentStopAfterCurrent (Cmd+Shift+.)", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStopAfterCurrent: handler,
          },
        }),
      )

      // Simulate Cmd+Shift+.
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: ".",
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("handles cycleTheme hotkey (Cmd+Shift+T)", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            cycleTheme: handler,
          },
        }),
      )

      // Simulate Cmd+Shift+T
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "t",
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("handles toggleTaskChat hotkey (Cmd+J)", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            toggleTaskChat: handler,
          },
        }),
      )

      // Simulate Cmd+J
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "j",
          metaKey: true,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("handles focusTaskChatInput hotkey (Cmd+3)", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            focusTaskChatInput: handler,
          },
        }),
      )

      // Simulate Cmd+3
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "3",
          metaKey: true,
          bubbles: true,
        })
        window.dispatchEvent(event)
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("prevents default and stops propagation when handler fires", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            toggleSidebar: handler,
          },
        }),
      )

      let preventDefaultCalled = false
      let stopPropagationCalled = false

      // Create event with spies
      const event = new KeyboardEvent("keydown", {
        key: "b",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      })

      // Override preventDefault and stopPropagation
      event.preventDefault = () => {
        preventDefaultCalled = true
      }
      event.stopPropagation = () => {
        stopPropagationCalled = true
      }

      act(() => {
        window.dispatchEvent(event)
      })

      expect(preventDefaultCalled).toBe(true)
      expect(stopPropagationCalled).toBe(true)
    })

    it("cleans up event listener on unmount", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

      const { unmount } = renderHook(() =>
        useHotkeys({
          handlers: {
            agentStart: handler,
          },
        }),
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        expect.objectContaining({ capture: true }),
      )
    })
  })

  describe("input element handling", () => {
    it("allows agent control hotkeys in input elements", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStart: handler,
          },
        }),
      )

      // Create an input element
      const input = document.createElement("input")
      document.body.appendChild(input)
      input.focus()

      // Simulate Cmd+Enter while focused on input
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "Enter",
          metaKey: true,
          bubbles: true,
        })
        Object.defineProperty(event, "target", { value: input })
        window.dispatchEvent(event)
      })

      // Should still fire for agent control hotkeys
      expect(handler).toHaveBeenCalledTimes(1)

      document.body.removeChild(input)
    })

    it("allows cycleTheme hotkey in input elements", () => {
      mockNavigator("MacIntel")
      const handler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            cycleTheme: handler,
          },
        }),
      )

      // Create an input element
      const input = document.createElement("input")
      document.body.appendChild(input)
      input.focus()

      // Simulate Cmd+Shift+T while focused on input
      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "t",
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        })
        Object.defineProperty(event, "target", { value: input })
        window.dispatchEvent(event)
      })

      // Should still fire for cycleTheme hotkey
      expect(handler).toHaveBeenCalledTimes(1)

      document.body.removeChild(input)
    })
  })

  describe("multiple handlers", () => {
    it("can register multiple handlers simultaneously", () => {
      mockNavigator("MacIntel")
      const startHandler = vi.fn()
      const stopHandler = vi.fn()
      const toggleHandler = vi.fn()

      renderHook(() =>
        useHotkeys({
          handlers: {
            agentStart: startHandler,
            agentStop: stopHandler,
            toggleSidebar: toggleHandler,
          },
        }),
      )

      // Trigger each hotkey
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            metaKey: true,
            bubbles: true,
          }),
        )
      })

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: ".",
            metaKey: true,
            bubbles: true,
          }),
        )
      })

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "b",
            metaKey: true,
            bubbles: true,
          }),
        )
      })

      expect(startHandler).toHaveBeenCalledTimes(1)
      expect(stopHandler).toHaveBeenCalledTimes(1)
      expect(toggleHandler).toHaveBeenCalledTimes(1)
    })
  })
})
