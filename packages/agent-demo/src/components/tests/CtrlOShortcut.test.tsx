import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { useAgentHotkeys } from "@herbcaudill/agent-view"

/**
 * Test file for bug r-3ssd4: ctrl-O shortcut not working in agent demo
 *
 * The original ctrl-O shortcut conflicted with the browser's "Open File" shortcut.
 * The fix changed the shortcut to cmd+shift+o (which is Ctrl+Shift+O on non-Mac).
 */

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
  if (opts.target) {
    Object.defineProperty(event, "target", { value: opts.target })
  }
  window.dispatchEvent(event)
}

describe("cmd+shift+o shortcut in agent-demo", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("calls toggleToolOutput handler when cmd+shift+o is pressed (non-Mac)", () => {
    const handler = vi.fn()
    renderHook(() =>
      useAgentHotkeys({
        handlers: { toggleToolOutput: handler },
      }),
    )

    // On non-Mac, cmd maps to ctrlKey
    fireKey({ key: "o", ctrlKey: true, shiftKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("calls toggleToolOutput handler when cmd+shift+o is pressed on Mac", () => {
    // Mock macOS platform
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel")

    const handler = vi.fn()
    renderHook(() =>
      useAgentHotkeys({
        handlers: { toggleToolOutput: handler },
      }),
    )

    // On Mac, cmd+shift+o uses metaKey + shiftKey
    fireKey({ key: "o", metaKey: true, shiftKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("works when multiple handlers are registered (like in App.tsx)", () => {
    const focusChatInput = vi.fn()
    const newSession = vi.fn()
    const toggleToolOutput = vi.fn()
    const scrollToBottom = vi.fn()
    const showHotkeys = vi.fn()

    renderHook(() =>
      useAgentHotkeys({
        handlers: {
          focusChatInput,
          newSession,
          toggleToolOutput,
          scrollToBottom,
          showHotkeys,
        },
      }),
    )

    fireKey({ key: "o", ctrlKey: true, shiftKey: true })
    expect(toggleToolOutput).toHaveBeenCalledTimes(1)
    expect(focusChatInput).not.toHaveBeenCalled()
    expect(newSession).not.toHaveBeenCalled()
    expect(scrollToBottom).not.toHaveBeenCalled()
    expect(showHotkeys).not.toHaveBeenCalled()
  })

  it("works when focus is on a textarea (like ChatInput)", () => {
    const handler = vi.fn()
    renderHook(() =>
      useAgentHotkeys({
        handlers: { toggleToolOutput: handler },
      }),
    )

    // Create a fake textarea element
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)

    // toggleToolOutput is in ALLOWED_IN_INPUT, so it should work
    fireKey({ key: "o", ctrlKey: true, shiftKey: true, target: textarea })
    expect(handler).toHaveBeenCalledTimes(1)

    textarea.remove()
  })
})
