import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { hotkeys, type BeadsHotkeyAction, type HotkeyConfig } from "../config"
import { useBeadsHotkeys, getHotkeyDisplayString } from "../useHotkeys"

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate a keydown event on `window` with the given properties. */
function fireKey(opts: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  target?: EventTarget
}) {
  const event = new KeyboardEvent("keydown", {
    key: opts.key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    altKey: opts.altKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  })
  // Override target if provided
  if (opts.target) {
    Object.defineProperty(event, "target", { value: opts.target })
  }
  window.dispatchEvent(event)
}

/** Create a minimal fake input element for isInputElement checks. */
function createFakeInput(tagName = "INPUT"): HTMLElement {
  const el = document.createElement(tagName)
  document.body.appendChild(el)
  return el
}

// ── Tests: hotkey config ─────────────────────────────────────────────────────

describe("hotkeys config", () => {
  const ALL_ACTIONS: BeadsHotkeyAction[] = [
    "focusSearch",
    "previousTask",
    "nextTask",
    "openTask",
    "showHotkeys",
    "previousWorkspace",
    "nextWorkspace",
  ]

  it("exports exactly the expected set of actions", () => {
    const actions = Object.keys(hotkeys)
    expect(actions).toHaveLength(ALL_ACTIONS.length)
    for (const action of ALL_ACTIONS) {
      expect(hotkeys).toHaveProperty(action)
    }
  })

  it("each action has key, modifiers, description, and category", () => {
    for (const action of ALL_ACTIONS) {
      const config = hotkeys[action]
      expect(config).toHaveProperty("key")
      expect(config).toHaveProperty("modifiers")
      expect(config).toHaveProperty("description")
      expect(config).toHaveProperty("category")
      expect(typeof config.key).toBe("string")
      expect(Array.isArray(config.modifiers)).toBe(true)
      expect(typeof config.description).toBe("string")
      expect(typeof config.category).toBe("string")
    }
  })

  it("parses cmd+f into key='f' with modifiers=['cmd']", () => {
    expect(hotkeys.focusSearch.key).toBe("f")
    expect(hotkeys.focusSearch.modifiers).toEqual(["cmd"])
  })

  it("parses ArrowUp with no modifiers", () => {
    expect(hotkeys.previousTask.key).toBe("ArrowUp")
    expect(hotkeys.previousTask.modifiers).toEqual([])
  })

  it("parses ArrowDown with no modifiers", () => {
    expect(hotkeys.nextTask.key).toBe("ArrowDown")
    expect(hotkeys.nextTask.modifiers).toEqual([])
  })

  it("parses Enter with no modifiers", () => {
    expect(hotkeys.openTask.key).toBe("Enter")
    expect(hotkeys.openTask.modifiers).toEqual([])
  })

  it("parses cmd+/ into key='/' with modifiers=['cmd']", () => {
    expect(hotkeys.showHotkeys.key).toBe("/")
    expect(hotkeys.showHotkeys.modifiers).toEqual(["cmd"])
  })

  it("parses cmd+PageUp into key='PageUp' with modifiers=['cmd']", () => {
    expect(hotkeys.previousWorkspace.key).toBe("PageUp")
    expect(hotkeys.previousWorkspace.modifiers).toEqual(["cmd"])
  })

  it("parses cmd+PageDown into key='PageDown' with modifiers=['cmd']", () => {
    expect(hotkeys.nextWorkspace.key).toBe("PageDown")
    expect(hotkeys.nextWorkspace.modifiers).toEqual(["cmd"])
  })

  it("assigns correct categories", () => {
    expect(hotkeys.focusSearch.category).toBe("Navigation")
    expect(hotkeys.previousTask.category).toBe("Navigation")
    expect(hotkeys.nextTask.category).toBe("Navigation")
    expect(hotkeys.openTask.category).toBe("Navigation")
    expect(hotkeys.showHotkeys.category).toBe("Help")
    expect(hotkeys.previousWorkspace.category).toBe("Navigation")
    expect(hotkeys.nextWorkspace.category).toBe("Navigation")
  })
})

// ── Tests: getHotkeyDisplayString ────────────────────────────────────────────

describe("getHotkeyDisplayString", () => {
  // jsdom reports navigator.platform as "" which doesn't match /Mac/,
  // so we effectively test the non-Mac (Windows/Linux) code path.

  it("formats a simple key with no modifiers", () => {
    const config: HotkeyConfig = {
      key: "Enter",
      modifiers: [],
      description: "test",
      category: "test",
    }
    // Non-Mac: Enter => special glyph
    expect(getHotkeyDisplayString(config)).toBe("\u23CE")
  })

  it("formats a key with cmd modifier (non-Mac)", () => {
    const config: HotkeyConfig = {
      key: "f",
      modifiers: ["cmd"],
      description: "test",
      category: "test",
    }
    // On non-Mac, cmd => "Ctrl", joined with "+"
    expect(getHotkeyDisplayString(config)).toBe("Ctrl+F")
  })

  it("formats a key with shift modifier (non-Mac)", () => {
    const config: HotkeyConfig = {
      key: "t",
      modifiers: ["shift"],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("Shift+T")
  })

  it("formats a key with multiple modifiers (non-Mac)", () => {
    const config: HotkeyConfig = {
      key: "t",
      modifiers: ["cmd", "shift"],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("Ctrl+Shift+T")
  })

  it("formats alt modifier (non-Mac)", () => {
    const config: HotkeyConfig = {
      key: "p",
      modifiers: ["alt"],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("Alt+P")
  })

  it("formats Escape key", () => {
    const config: HotkeyConfig = {
      key: "Escape",
      modifiers: [],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("Esc")
  })

  it("formats arrow keys", () => {
    const up: HotkeyConfig = { key: "ArrowUp", modifiers: [], description: "", category: "" }
    const down: HotkeyConfig = { key: "ArrowDown", modifiers: [], description: "", category: "" }
    const left: HotkeyConfig = { key: "ArrowLeft", modifiers: [], description: "", category: "" }
    const right: HotkeyConfig = { key: "ArrowRight", modifiers: [], description: "", category: "" }

    expect(getHotkeyDisplayString(up)).toBe("\u2191")
    expect(getHotkeyDisplayString(down)).toBe("\u2193")
    expect(getHotkeyDisplayString(left)).toBe("\u2190")
    expect(getHotkeyDisplayString(right)).toBe("\u2192")
  })

  it("formats PageUp key with cmd modifier (non-Mac)", () => {
    const config: HotkeyConfig = {
      key: "PageUp",
      modifiers: ["cmd"],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("Ctrl+PgUp")
  })

  it("formats PageDown key with cmd modifier (non-Mac)", () => {
    const config: HotkeyConfig = {
      key: "PageDown",
      modifiers: ["cmd"],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("Ctrl+PgDn")
  })

  it("formats Backspace key", () => {
    const config: HotkeyConfig = {
      key: "Backspace",
      modifiers: [],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("\u232B")
  })

  it("uppercases plain letter keys", () => {
    const config: HotkeyConfig = {
      key: "x",
      modifiers: [],
      description: "test",
      category: "test",
    }
    expect(getHotkeyDisplayString(config)).toBe("X")
  })
})

// ── Tests: useBeadsHotkeys hook ──────────────────────────────────────────────

describe("useBeadsHotkeys", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("handler invocation", () => {
    it("calls the handler when its hotkey is pressed", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      // focusSearch is cmd+f; on non-Mac cmd maps to ctrlKey
      fireKey({ key: "f", ctrlKey: true })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("calls the correct handler for multiple registered hotkeys", () => {
      const searchHandler = vi.fn()
      const showHandler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: {
            focusSearch: searchHandler,
            showHotkeys: showHandler,
          },
        }),
      )

      fireKey({ key: "f", ctrlKey: true })
      expect(searchHandler).toHaveBeenCalledTimes(1)
      expect(showHandler).not.toHaveBeenCalled()

      fireKey({ key: "/", ctrlKey: true })
      expect(showHandler).toHaveBeenCalledTimes(1)
    })

    it("does not call handler for non-matching key", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      fireKey({ key: "x", ctrlKey: true })
      expect(handler).not.toHaveBeenCalled()
    })

    it("does not call handler when modifier is missing", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      // Press "f" without Ctrl/Cmd
      fireKey({ key: "f" })
      expect(handler).not.toHaveBeenCalled()
    })

    it("does not call handler when extra modifier is pressed", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      // Press Ctrl+Shift+F when only Ctrl+F is expected
      fireKey({ key: "f", ctrlKey: true, shiftKey: true })
      expect(handler).not.toHaveBeenCalled()
    })

    it("calls handler for keys without modifiers (e.g., ArrowUp)", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { previousTask: handler },
        }),
      )

      fireKey({ key: "ArrowUp" })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("calls handler for Enter", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { openTask: handler },
        }),
      )

      fireKey({ key: "Enter" })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("calls handler for cmd+PageUp (previousWorkspace)", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { previousWorkspace: handler },
        }),
      )

      // On non-Mac, cmd maps to ctrlKey
      fireKey({ key: "PageUp", ctrlKey: true })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("calls handler for cmd+PageDown (nextWorkspace)", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { nextWorkspace: handler },
        }),
      )

      // On non-Mac, cmd maps to ctrlKey
      fireKey({ key: "PageDown", ctrlKey: true })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("does not fire when no handler is registered for the action", () => {
      // Register only focusSearch, press ArrowUp (previousTask) -- should not throw
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      fireKey({ key: "ArrowUp" })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe("enabled / disabled", () => {
    it("does not call handlers when disabled", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
          enabled: false,
        }),
      )

      fireKey({ key: "f", ctrlKey: true })
      expect(handler).not.toHaveBeenCalled()
    })

    it("is enabled by default", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      fireKey({ key: "f", ctrlKey: true })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("responds to enabled changing from false to true", () => {
      const handler = vi.fn()
      const { rerender } = renderHook(
        ({ enabled }) =>
          useBeadsHotkeys({
            handlers: { focusSearch: handler },
            enabled,
          }),
        { initialProps: { enabled: false } },
      )

      fireKey({ key: "f", ctrlKey: true })
      expect(handler).not.toHaveBeenCalled()

      rerender({ enabled: true })

      fireKey({ key: "f", ctrlKey: true })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe("input element blocking", () => {
    let inputEl: HTMLElement

    beforeEach(() => {
      inputEl = createFakeInput("INPUT")
    })

    afterEach(() => {
      inputEl.remove()
    })

    it("blocks non-allowed actions when target is an input element", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { previousTask: handler },
        }),
      )

      // previousTask (ArrowUp) is NOT in ALLOWED_IN_INPUT
      fireKey({ key: "ArrowUp", target: inputEl })
      expect(handler).not.toHaveBeenCalled()
    })

    it("allows focusSearch when target is an input element", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      fireKey({ key: "f", ctrlKey: true, target: inputEl })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("allows showHotkeys when target is an input element", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { showHotkeys: handler },
        }),
      )

      fireKey({ key: "/", ctrlKey: true, target: inputEl })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("allows previousWorkspace when target is an input element", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { previousWorkspace: handler },
        }),
      )

      fireKey({ key: "PageUp", ctrlKey: true, target: inputEl })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("allows nextWorkspace when target is an input element", () => {
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { nextWorkspace: handler },
        }),
      )

      fireKey({ key: "PageDown", ctrlKey: true, target: inputEl })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("blocks openTask (Enter) when target is a textarea", () => {
      const textarea = createFakeInput("TEXTAREA")
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { openTask: handler },
        }),
      )

      fireKey({ key: "Enter", target: textarea })
      expect(handler).not.toHaveBeenCalled()
      textarea.remove()
    })

    it("blocks nextTask (ArrowDown) when target is a select", () => {
      const selectEl = createFakeInput("SELECT")
      const handler = vi.fn()
      renderHook(() =>
        useBeadsHotkeys({
          handlers: { nextTask: handler },
        }),
      )

      fireKey({ key: "ArrowDown", target: selectEl })
      expect(handler).not.toHaveBeenCalled()
      selectEl.remove()
    })
  })

  describe("getHotkeyDisplay return value", () => {
    it("returns display string for a registered action", () => {
      const { result } = renderHook(() => useBeadsHotkeys({ handlers: {} }))

      // focusSearch is cmd+f => on non-Mac: "Ctrl+F"
      expect(result.current.getHotkeyDisplay("focusSearch")).toBe("Ctrl+F")
    })

    it("returns arrow glyph for previousTask", () => {
      const { result } = renderHook(() => useBeadsHotkeys({ handlers: {} }))

      expect(result.current.getHotkeyDisplay("previousTask")).toBe("\u2191")
    })

    it("returns enter glyph for openTask", () => {
      const { result } = renderHook(() => useBeadsHotkeys({ handlers: {} }))

      expect(result.current.getHotkeyDisplay("openTask")).toBe("\u23CE")
    })
  })

  describe("registeredHotkeys", () => {
    it("returns all hotkey actions with display and description", () => {
      const { result } = renderHook(() => useBeadsHotkeys({ handlers: {} }))

      const registered = result.current.registeredHotkeys
      expect(registered).toHaveLength(7)

      const actions = registered.map(r => r.action)
      expect(actions).toContain("focusSearch")
      expect(actions).toContain("previousTask")
      expect(actions).toContain("nextTask")
      expect(actions).toContain("openTask")
      expect(actions).toContain("showHotkeys")
      expect(actions).toContain("previousWorkspace")
      expect(actions).toContain("nextWorkspace")
    })

    it("each entry has a non-empty display string", () => {
      const { result } = renderHook(() => useBeadsHotkeys({ handlers: {} }))

      for (const entry of result.current.registeredHotkeys) {
        expect(entry.display.length).toBeGreaterThan(0)
      }
    })

    it("each entry has a non-empty description", () => {
      const { result } = renderHook(() => useBeadsHotkeys({ handlers: {} }))

      for (const entry of result.current.registeredHotkeys) {
        expect(entry.description.length).toBeGreaterThan(0)
      }
    })
  })

  describe("cleanup", () => {
    it("removes the event listener on unmount", () => {
      const handler = vi.fn()
      const { unmount } = renderHook(() =>
        useBeadsHotkeys({
          handlers: { focusSearch: handler },
        }),
      )

      unmount()

      fireKey({ key: "f", ctrlKey: true })
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
